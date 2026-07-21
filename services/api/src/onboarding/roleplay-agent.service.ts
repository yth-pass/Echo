/**
 * Phase 2 对话式角色扮演服务
 *
 * 实现 4 个 AI 角色（阿远/小鹿/小夜/老许）的对话式语言风格采集。
 * 核心流程：startChat → chatTurn (N 轮) → endChat → extractStyleProfile
 *
 * 设计文档 §六 8 条硬规则全部嵌入 prompt + 后处理管道。
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import type {
  AgentProfiles,
  OnboardingSurveyJson,
  RoleplayChat,
  StyleProfile,
} from './survey-schema';
import {
  ROLE_DEFINITIONS,
  IMPERFECTION_PROBS,
  calcTypingDelayMs,
  calcSplitDelayMs,
  detectAiSpeech,
  isValidRoleName,
  getRoleDefinition,
  type RoleName,
} from './roleplay-agents';

// ---------- 导出类型 ----------

export interface ReplyMessage {
  content: string;
  /** 前端"对方正在输入…"延迟（毫秒） */
  delayMs: number;
  /** 是否是打错字后的纠正消息 */
  isTypoCorrection: boolean;
}

export interface ChatSummary {
  chatId: string;
  roleName: RoleName;
  agentName: string;
  messageCount: number;
  qualityFlag: 'good' | 'low_effort' | 'incomplete';
  startedAt: number;
  endedAt: number;
}

/** GET /onboarding/roleplay/chats 返回的单条 chat 概要（用于前端同步 completedRoles） */
export interface RoleplayChatSummary {
  chatId: string;
  roleName: RoleName;
  agentName: string;
  /** active=可继续聊，ended=已结束（前端应标记为完成） */
  status: 'active' | 'ended';
  messageCount: number;
  startedAt: number;
  endedAt: number;
  /** 结束原因：manual=用户点结束按钮，auto_farewell=双方告别自动结束 */
  endedReason?: 'manual' | 'auto_farewell';
}

/** POST /onboarding/roleplay/start 返回结构（A3 改造：新增 status / existingMessages / endedReason） */
export interface StartChatResponse {
  chatId: string;
  openingMessage: string;
  agentName: string;
  /** chat 当前状态：active=可继续聊，ended=已结束（前端应标记为完成并停留角色屏） */
  status: 'active' | 'ended';
  /** 当 status='ended' 时返回历史消息，让前端可展示或选择重新开始 */
  existingMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  /** 当 status='ended' 时返回结束原因 */
  endedReason?: 'manual' | 'auto_farewell';
}

// ---------- 同音字映射表（拼音输入法常见误选） ----------

const HOMOPHONE_MAP: Record<string, string[]> = {
  // 高频语法虚词
  '的': ['地', '得'], '地': ['的', '得'], '得': ['的', '地'],
  '在': ['再'],       '再': ['在'],
  '做': ['作'],       '作': ['做'],
  '像': ['象'],       '象': ['像'],
  '已': ['以'],       '以': ['已'],
  '带': ['代'],       '代': ['带'],
  '必': ['毕'],       '毕': ['必'],
  // 日常实词
  '话': ['化'],       '化': ['话'],
  '元': ['原'],       '原': ['元'],
  '玩': ['完'],       '完': ['玩'],
  '看': ['堪'],       '堪': ['看'],
  '想': ['相'],       '相': ['想'],
  '到': ['道'],       '道': ['到'],
  '事': ['是'],       '是': ['事'],
  '长': ['常'],       '常': ['长'],
  // 口语高频
  '嘛': ['妈'],       '妈': ['嘛'],
  '吧': ['把'],       '把': ['吧'],
  '没': ['每'],       '每': ['没'],
  '谁': ['水'],       '水': ['谁'],
  '去': ['取'],       '取': ['去'],
  '要': ['药'],       '药': ['要'],
  '和': ['合'],       '合': ['和'],
  '干': ['赶'],       '赶': ['干'],
};

// ---------- Service ----------

@Injectable()
export class RoleplayAgentService {
  private readonly logger = new Logger(RoleplayAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // -----------------------------------------------------------------------
  // Method 1: startChat
  // -----------------------------------------------------------------------

  /**
   * 启动或复用 roleplay 对话。
   *
   * A3 改造后的行为：
   *   - existingChat 未结束（endedAt=0）→ 复用，返回 status='active'
   *   - existingChat 已结束（endedAt>0）→ 返回 status='ended' + existingMessages + endedReason
   *     （不自动新建，把决定权交给前端：前端应标记为完成并停留角色屏）
   *   - 不存在 → 新建，返回 status='active'
   *
   * 这样前端能在 mount 时通过单次调用拿到权威状态，避免 localStorage 与后端不同步。
   */
  async startChat(
    userId: string,
    roleName: string,
  ): Promise<StartChatResponse> {
    if (!isValidRoleName(roleName)) {
      throw new BadRequestException(
        `无效角色 "${roleName}"，必须是: stranger / bestfriend / crush / disappointed`,
      );
    }

    const { session, survey } = await this.getActiveSession(userId);
    const userGender = survey.identity?.genderIdentity ?? 'unspecified';
    const role = getRoleDefinition(roleName, userGender);

    // 检查是否已有该角色的对话（含已结束和未结束）
    const existingChat = this.findChatByRole(survey, roleName);
    if (existingChat) {
      const existingChatWithId = existingChat as RoleplayChat & { chatId: string };

      if (!existingChat.endedAt) {
        // 情况 1：未结束 → 复用，返回 active 状态
        return {
          chatId: existingChatWithId.chatId,
          openingMessage:
            existingChat.messages[0]?.content ?? role.openingMessage,
          agentName: role.agentName,
          status: 'active',
        };
      }

      // 情况 2：已结束 → 返回 ended 状态 + 历史消息 + 结束原因（不自动新建）
      // 推断结束原因：qualityFlag='incomplete' 通常是自动告别结束（对话未达 3 轮）
      // 其他情况（good / low_effort）通常是用户手动结束
      const endedReason: 'manual' | 'auto_farewell' =
        existingChat.qualityFlag === 'incomplete' ? 'auto_farewell' : 'manual';

      return {
        chatId: existingChatWithId.chatId,
        openingMessage:
          existingChat.messages[0]?.content ?? role.openingMessage,
        agentName: role.agentName,
        status: 'ended',
        existingMessages: existingChat.messages,
        endedReason,
      };
    }

    // 情况 3：不存在 → 新建（原逻辑）
    const genderedPrompt = this.resolveGenderPrompt(role.systemPrompt, survey);
    const personaContext = this.buildPersonaContext(survey, roleName);
    const systemPrompt = personaContext
      ? `${genderedPrompt}\n\n${personaContext}`
      : genderedPrompt;

    const chatId = this.generateId();
    const now = Date.now();

    const newChat: RoleplayChat & { chatId: string } = {
      chatId,
      roleName,
      agentName: role.agentName,
      messages: [
        { role: 'assistant', content: role.openingMessage, timestamp: now },
      ],
      startedAt: now,
      endedAt: 0,
    };

    // 写入 surveyJson.roleplayChats
    const roleplayChats = survey.roleplayChats ?? [];
    roleplayChats.push(newChat);
    await this.persistSurvey(session.id, { ...survey, roleplayChats });

    this.logger.log(
      `Roleplay chat started: userId=${userId} role=${roleName} chatId=${chatId}`,
    );

    return {
      chatId,
      openingMessage: role.openingMessage,
      agentName: role.agentName,
      status: 'active',
    };
  }

  // -----------------------------------------------------------------------
  // Method 1.5: listChats (A2 新增 — 用于前端 mount 时同步 completedRoles)
  // -----------------------------------------------------------------------

  /**
   * 列出当前用户所有 roleplay chat 的状态概要。
   * 前端 Phase2Roleplay mount 时调用，避免 localStorage 与后端状态不同步。
   * 幂等：纯读操作，不修改 surveyJson。
   */
  async listChats(userId: string): Promise<{ chats: RoleplayChatSummary[] }> {
    const { survey } = await this.getActiveSession(userId);
    const chats = survey.roleplayChats ?? [];

    return {
      chats: chats.map((c) => {
        const chatWithId = c as RoleplayChat & { chatId: string };
        const isEnded = c.endedAt > 0;
        return {
          chatId: chatWithId.chatId,
          roleName: c.roleName,
          agentName: c.agentName,
          status: isEnded ? 'ended' : 'active',
          messageCount: c.messages.length,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
          endedReason: isEnded
            ? c.qualityFlag === 'incomplete'
              ? 'auto_farewell'
              : 'manual'
            : undefined,
        };
      }),
    };
  }

  // -----------------------------------------------------------------------
  // Method 2: chatTurn
  // -----------------------------------------------------------------------

  async chatTurn(
    userId: string,
    chatId: string,
    userMessage: string,
  ): Promise<{ replies: ReplyMessage[]; ended: boolean }> {
    const { session, survey } = await this.getActiveSession(userId);
    const chat = this.findChatById(survey, chatId);
    if (!chat) throw new BadRequestException('对话不存在');
    if (chat.endedAt) throw new BadRequestException('对话已结束');

    const chatWithId = chat as RoleplayChat & { chatId: string };
    const userGender = survey.identity?.genderIdentity ?? 'unspecified';
    const role = getRoleDefinition(chatWithId.roleName, userGender);

    // 追加用户消息
    const now = Date.now();
    chatWithId.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: now,
    });

    // — 告别检测：双方都说了结束语就不再回复 —
    const userSaidFarewell = this.isFarewell(userMessage);
    if (userSaidFarewell && this.agentSaidFarewell(chatWithId.messages)) {
      // 双方都已告别，自动结束对话，不再生成回复
      chatWithId.endedAt = Date.now();
      chatWithId.qualityFlag =
        chatWithId.messages.filter((m) => m.role === 'user').length >= 3
          ? 'good'
          : 'incomplete';
      await this.persistSurvey(session.id, survey);
      this.logger.log(
        `Auto-ended chat after mutual farewell: chatId=${chatId}`,
      );
      return { replies: [], ended: true };
    }

    // — 不完美行为：决策（在 LLM 调用前确定，用于修改 prompt） —
    const rand = this.rand();
    let behaviorHint = '';
    let shouldSplit = false;
    let shouldTypo = false;

    if (rand < IMPERFECTION_PROBS.topicDrift) {
      behaviorHint += '\n[系统提示：这一轮你可以自然地聊到另一个相关话题，不用完美接住对方的话。]\n';
    } else if (rand < IMPERFECTION_PROBS.topicDrift + IMPERFECTION_PROBS.forgetContext) {
      behaviorHint += '\n[系统提示：你可以稍微忘记之前聊过的某个细节，表现得像记不太清了。]\n';
    } else if (
      rand <
      IMPERFECTION_PROBS.topicDrift +
        IMPERFECTION_PROBS.forgetContext +
        IMPERFECTION_PROBS.disagree
    ) {
      behaviorHint += '\n[系统提示：这一轮你可以不同意对方的观点，用自己的方式反驳。]\n';
    }

    // 分段 & 打错字（互斥优先级链）
    const rand2 = this.rand();
    if (rand2 < IMPERFECTION_PROBS.splitMessage) {
      shouldSplit = true;
    } else if (rand2 < IMPERFECTION_PROBS.splitMessage + IMPERFECTION_PROBS.typo) {
      shouldTypo = true;
    }

    // 脆弱分享检测：如果对话已经够长但还没分享过，注入提示
    const needsVulnerability = this.shouldShareVulnerability(
      chatWithId.messages,
    );
    if (needsVulnerability) {
      behaviorHint +=
        '\n[系统提示：对话已经进行了一段时间，这一轮请自然地分享一个你自己的脆弱时刻或真实烦恼。]\n';
    }

    // 告别提示：用户说了结束语但 agent 还没说，用一句话简短告别
    if (userSaidFarewell) {
      behaviorHint +=
        '\n[系统提示：对方在跟你告别了。请只回一句简短自然的告别语，不要太长。说完就结束，不要追问或展开新话题。]\n';
      shouldSplit = false;
      shouldTypo = false;
    }

    // — 构建 LLM 消息（每轮注入 persona context + 性别感知） —
    const genderedPrompt = this.resolveGenderPrompt(role.systemPrompt, survey);
    const personaContext = this.buildPersonaContext(survey, chatWithId.roleName);
    const basePrompt = personaContext
      ? `${genderedPrompt}\n\n${personaContext}`
      : genderedPrompt;
    const fullSystemPrompt = basePrompt + behaviorHint;
    const messages: Parameters<LlmService['chat']>[0] = [
      { role: 'system', content: fullSystemPrompt },
      ...chatWithId.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // — 调用 LLM（含 1 次重试） —
    let raw = await this.llm.chat(messages, {
      temperature: 0.85,
      maxTokens: 500,
    });
    if (!raw) {
      this.logger.warn('LLM returned null on roleplay chatTurn, retrying...');
      raw = await this.llm.chat(messages, {
        temperature: 0.85,
        maxTokens: 500,
      });
    }
    if (!raw) {
      throw new ServiceUnavailableException('LLM 服务暂时不可用，请稍后重试');
    }

    // — Rule 4: AI 腔黑名单过滤（最多重生成 1 次） —
    const hits = detectAiSpeech(raw);
    if (hits.length > 0) {
      this.logger.warn(
        `AI speech detected in roleplay [${chatWithId.roleName}]: ${hits.join(', ')}. Regenerating.`,
      );
      const blacklistNote = `\n[紧急提醒：你刚才的回复包含了以下 AI 腔表达：${hits.join('、')}。请完全用你的角色风格重写回复，绝对不能出现这些表达。]`;
      messages.push(
        { role: 'assistant', content: raw },
        { role: 'user', content: blacklistNote },
      );
      const regenerated = await this.llm.chat(messages, {
        temperature: 0.9,
        maxTokens: 500,
      });
      if (regenerated) {
        // 二次检测：如果还有黑名单，强制替换为安全回复
        if (detectAiSpeech(regenerated).length === 0) {
          raw = regenerated;
        } else {
          raw = this.fallbackReply(chatWithId.roleName);
        }
      }
    }

    // — 不完美行为：后处理 —
    const replies: ReplyMessage[] = [];

    // 先按换行拆分，确保每条 reply 都是独立气泡（不含 \n）
    // 过滤掉无意义段落（纯标点、纯 emoji、过短无实质内容）
    const rawParagraphs = raw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => {
        if (!s) return false;
        // 包含至少一个中文字符或字母才算有意义
        return /[\u4e00-\u9fffA-Za-z]/.test(s);
      });

    // 合并过短的片段（≤3字符）到上一条，避免碎片气泡
    const paragraphs: string[] = [];
    for (const p of rawParagraphs) {
      if (p.length <= 3 && paragraphs.length > 0) {
        paragraphs[paragraphs.length - 1] += p;
      } else {
        paragraphs.push(p);
      }
    }

    for (const para of paragraphs) {
      if (shouldTypo) {
        const typoResult = this.injectTypo(para);
        if (typoResult) {
          replies.push({
            content: typoResult.mainText,
            delayMs: calcTypingDelayMs(typoResult.mainText),
            isTypoCorrection: false,
          });
          replies.push({
            content: typoResult.correction,
            delayMs: calcSplitDelayMs(),
            isTypoCorrection: true,
          });
          // 打错字只触发一次，后续段落正常发送
          shouldTypo = false;
          continue;
        }
        // 没有同音字可替换，放弃本次 typo，走正常流程
        shouldTypo = false;
      }
      if (shouldSplit) {
        const segments = this.splitIntoSegments(para);
        for (const seg of segments) {
          replies.push({
            content: seg,
            delayMs: calcTypingDelayMs(seg),
            isTypoCorrection: false,
          });
        }
      } else {
        replies.push({
          content: para,
          delayMs: calcTypingDelayMs(para),
          isTypoCorrection: false,
        });
      }
    }

    // 偶尔追加一条口语化 follow-up（仅当段落较少时）
    if (shouldSplit && this.rand() < 0.4 && paragraphs.length <= 2) {
      const followUp = this.generateFollowUp(chatWithId.roleName);
      if (followUp) {
        replies.push({
          content: followUp,
          delayMs: calcSplitDelayMs(),
          isTypoCorrection: false,
        });
      }
    }

    // — 持久化 —
    for (const reply of replies) {
      chatWithId.messages.push({
        role: 'assistant',
        content: reply.content,
        timestamp: Date.now(),
      });
    }

    await this.persistSurvey(session.id, survey);

    return { replies, ended: false };
  }

  // -----------------------------------------------------------------------
  // Method 3: endChat
  // -----------------------------------------------------------------------

  async endChat(
    userId: string,
    chatId: string,
  ): Promise<{ success: boolean; chatSummary: ChatSummary }> {
    const { session, survey } = await this.getActiveSession(userId);
    const chat = this.findChatById(survey, chatId);
    if (!chat) throw new BadRequestException('对话不存在');

    const chatWithId = chat as RoleplayChat & { chatId: string };
    const userGender = survey.identity?.genderIdentity ?? 'unspecified';
    const role = getRoleDefinition(chatWithId.roleName, userGender);

    // 生成自然收尾消息
    const closingMsg = role.closingMessage;
    chatWithId.messages.push({
      role: 'assistant',
      content: closingMsg,
      timestamp: Date.now(),
    });
    chatWithId.endedAt = Date.now();

    // 评估质量标记
    const userMessages = chatWithId.messages.filter((m) => m.role === 'user');
    const shortReplies = userMessages.filter((m) => m.content.length <= 2);
    let qualityFlag: 'good' | 'low_effort' | 'incomplete' = 'good';
    if (userMessages.length < 3) {
      qualityFlag = 'incomplete';
    } else if (shortReplies.length > userMessages.length * 0.5) {
      qualityFlag = 'low_effort';
    }
    chatWithId.qualityFlag = qualityFlag;

    await this.persistSurvey(session.id, survey);

    this.logger.log(
      `Roleplay chat ended: chatId=${chatId} messages=${chatWithId.messages.length} quality=${qualityFlag}`,
    );

    return {
      success: true,
      chatSummary: {
        chatId: chatWithId.chatId,
        roleName: chatWithId.roleName,
        agentName: chatWithId.agentName,
        messageCount: chatWithId.messages.length,
        qualityFlag,
        startedAt: chatWithId.startedAt,
        endedAt: chatWithId.endedAt,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Method 4: extractStyleProfile
  // -----------------------------------------------------------------------

  async extractStyleProfile(
    userId: string,
  ): Promise<{ styleProfile: StyleProfile; styleMd: string }> {
    const { session, survey } = await this.getActiveSession(userId);

    const chats = survey.roleplayChats ?? [];
    const completedChats = chats.filter((c) => c.endedAt > 0);

    if (completedChats.length < 2) {
      throw new BadRequestException(
        '至少需要完成 2 段对话才能提取语言风格，当前已完成: ' +
          completedChats.length,
      );
    }

    // 构建提取 prompt：把所有完成对话的用户消息拼在一起
    const conversationTexts = completedChats
      .map((chat) => {
        const role = ROLE_DEFINITIONS[chat.roleName];
        const userMsgs = chat.messages.filter((m) => m.role === 'user');
        return `## 对话：与${role.agentName}（${chat.roleName}）\n${userMsgs.map((m) => m.content).join('\n')}`;
      })
      .join('\n\n');

    const extractPrompt = `你是 Echo 的语言风格分析师。请分析以下用户在 4 段角色扮演对话中的语言风格特征。

用户的对话记录：
${conversationTexts}

请输出严格的 JSON（不要 markdown 代码块包裹），结构如下：
{
  "baselineParams": {
    "avgReplyLength": <数字，平均回复字数>,
    "sentenceLengthDist": { "short_under10": <比例 0-1>, "medium_10to25": <比例>, "long_over25": <比例> },
    "emojiDensity": <数字，每条消息平均 emoji 数>,
    "punctuationHabits": { "period": <比例 0-1>, "ellipsis": <比例>, "exclamation": <比例>, "question": <比例>, "comma": <比例> },
    "topCatchphrases": [<字符串数组，top 5 口头禅，没有就空数组>],
    "commonParticles": [<字符串数组，常见语气词，如 "嗯" "啊" "吧" "呢">]
  },
  "relationSwitchRules": {
    "stranger": <面对陌生人时的语言特点描述>,
    "bestfriend": <面对死党时的语言特点描述>,
    "crush": <面对暧昧对象时的语言特点描述>,
    "disappointed": <面对失望的人时的语言特点描述>
  },
  "emotionalReactionPatterns": {
    "goodNews": <收到好消息时的反应模式>,
    "badNews": <收到坏消息时的反应模式>,
    "ambiguousSignal": <面对暧昧信号时的反应>,
    "confrontation": <面对矛盾追问时的反应>
  },
  "boundaries": [<字符串数组，用户明显回避的话题或表达方式>]
}`;

    const messages: Parameters<LlmService['chat']>[0] = [
      { role: 'system', content: extractPrompt },
      {
        role: 'user',
        content:
          '请根据上面的对话记录分析用户的语言风格，输出 JSON。',
      },
    ];

    let raw = await this.llm.chat(messages, {
      temperature: 0.3,
      maxTokens: 1500,
    });
    if (!raw) {
      this.logger.warn(
        'LLM returned null on style extraction, retrying...',
      );
      raw = await this.llm.chat(messages, {
        temperature: 0.3,
        maxTokens: 1500,
      });
    }
    if (!raw) {
      throw new ServiceUnavailableException('LLM 服务暂时不可用，请稍后重试');
    }

    // 解析 JSON（兼容 markdown 代码块包裹）
    const styleProfile = this.parseStyleProfileJson(raw);

    // 生成可读 style.md
    const styleMd = this.buildStyleMd(styleProfile);

    // 写入 surveyJson.styleProfile
    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      styleProfile,
    };
    await this.persistSurvey(session.id, updatedSurvey);

    // 同步写入 Profile.styleMd
    await this.prisma.profile.upsert({
      where: { userId },
      update: { styleMd },
      create: { userId, styleMd },
    });

    this.logger.log(
      `Style profile extracted: userId=${userId} chats=${completedChats.length}`,
    );

    return { styleProfile, styleMd };
  }

  // -----------------------------------------------------------------------
  // Method 5: generateAgentProfiles (Phase 1.7)
  // -----------------------------------------------------------------------

  async generateAgentProfiles(
    userId: string,
  ): Promise<{ agentProfiles: AgentProfiles }> {
    const { session, survey } = await this.getActiveSession(userId);

    // 需要 Phase 1.5 画像才能生成
    if (!survey.personaSketch) {
      throw new BadRequestException(
        '需要先生成人格画像（Phase 1.5）才能生成角色档案',
      );
    }

    // 如果已经生成过且未修改画像，直接返回
    if (survey.agentProfiles?.generationTimestamp) {
      const sketchTs = survey.personaSketch.generationTimestamp ?? 0;
      const profilesTs = survey.agentProfiles.generationTimestamp ?? 0;
      if (profilesTs >= sketchTs) {
        return { agentProfiles: survey.agentProfiles };
      }
    }

    const id = survey.identity;
    const name = id?.displayName ?? '用户';
    const gender = id?.genderIdentity ?? 'unspecified';

    // 收集 Phase 1 卡片回答摘要
    const cardsSummary = (survey.scenarioCards ?? [])
      .slice(0, 15)
      .map((c, i) => `卡片${i + 1}(${c.cardId}): 选${c.choice}${c.freeText ? ' — ' + c.freeText : ''}`)
      .join('\n');

    const genderNote =
      gender === 'male'
        ? '用户是男性，所有 4 个角色都设定为女性（异性）'
        : gender === 'female'
          ? '用户是女性，所有 4 个角色都设定为男性（异性）'
          : '用户性别未指定，请根据上下文合理设定所有角色为异性';

    const extractPrompt = `你是 Echo 的角色设计师。请根据用户的人格画像和回答，为 4 个 AI 角色设计个性化的人物档案。

${genderNote}

## 用户基本信息
- 名字：${name}
- 性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未指定'}
- 年龄：${id?.ageBand ?? '未知'}
- 职业：${id?.occupation ?? '未知'}
- 兴趣：${(survey.interests ?? []).join('、') || '未知'}

## 用户人格画像
${survey.personaSketch.narrative}

## 画像细节
- 性格质感：${survey.personaSketch.sections.personalityTexture}
- 核心信念：${survey.personaSketch.sections.coreBeliefs}
- 关心方式：${survey.personaSketch.sections.caringStyle}
- 内在矛盾：${survey.personaSketch.sections.contradictions}

## 用户回答摘要（Phase 1 卡片）
${cardsSummary || '（无卡片回答）'}

请为以下 4 个角色各设计一份人物档案。每个角色的性格、说话方式、和用户的关系都要和用户的画像高度匹配——就像真人朋友一样。

请输出严格的 JSON（不要 markdown 代码块包裹），结构如下：
{
  "stranger": {
    "personality": "<2-3句描述这个人的性格>",
    "speechStyle": "<说话风格特征，如爱用反问句、喜欢自嘲>",
    "sharedContext": "<你们刚认识的共同点或破冰话题>",
    "relationshipDynamics": "<关系动态，如轻松好奇、互相试探>",
    "topicAffinity": ["<话题1>", "<话题2>", "<话题3>"]
  },
  "bestfriend": {
    "personality": "<2-3句，这个很聊得来的异性朋友是什么样的人>",
    "speechStyle": "<说话风格，要和用户匹配——比如用户话多就更话痨，用户安静就更主动>",
    "sharedContext": "<你们之间虚构的共同回忆和日常>",
    "relationshipDynamics": "<关系模式，如表面互损实际最铁、无话不谈>",
    "topicAffinity": ["<话题1>", "<话题2>", "<话题3>"]
  },
  "crush": {
    "personality": "<2-3句，暧昧对象是什么样的人>",
    "speechStyle": "<说话风格，要有心动感>",
    "sharedContext": "<你们之间的微妙互动场景>",
    "relationshipDynamics": "<关系动态，如欲言又止、互相在意>",
    "topicAffinity": ["<话题1>", "<话题2>", "<话题3>"]
  },
  "disappointed": {
    "personality": "<2-3句，这个人是什么样的人，以及最近做了什么让用户失望的事>",
    "speechStyle": "<说话风格，有点心虚但不太愿认错，会先试探再解释>",
    "sharedContext": "<你们之前聊得不错的经历，以及最近发生的不愉快事件>",
    "relationshipDynamics": "<关系动态，从有好感到出现裂痕的微妙变化>",
    "topicAffinity": ["<话题1>", "<话题2>", "<话题3>"]
  }
}`;

    const messages: Parameters<LlmService['chat']>[0] = [
      { role: 'system', content: extractPrompt },
      {
        role: 'user',
        content: '请根据上面的画像和回答设计 4 个角色的人物档案，输出 JSON。',
      },
    ];

    let raw = await this.llm.chat(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });
    if (!raw) {
      this.logger.warn('LLM returned null on agent profile generation, retrying...');
      raw = await this.llm.chat(messages, {
        temperature: 0.7,
        maxTokens: 2000,
      });
    }
    if (!raw) {
      throw new ServiceUnavailableException('LLM 服务暂时不可用，请稍后重试');
    }

    // 解析 JSON（兼容 markdown 代码块包裹）
    const profiles = this.parseAgentProfilesJson(raw);

    const agentProfiles: AgentProfiles = {
      ...profiles,
      generationTimestamp: Date.now(),
    };

    // 写入 surveyJson
    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      agentProfiles,
    };
    await this.persistSurvey(session.id, updatedSurvey);

    this.logger.log(
      `Agent profiles generated: userId=${userId} roles=${Object.keys(profiles).join(',')}`,
    );

    return { agentProfiles };
  }

  // =======================================================================
  // 内部方法
  // =======================================================================

  /** 获取未完成的 OnboardingSession + surveyJson */
  private async getActiveSession(
    userId: string,
  ): Promise<{ session: { id: string }; survey: OnboardingSurveyJson }> {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      throw new BadRequestException('尚未开始入驻流程');
    }
    const survey =
      (session.surveyJson as unknown as OnboardingSurveyJson | null) ?? {};
    return { session, survey };
  }

  /** 按 roleName 查找对话（含已完成和未完成） */
  private findChatByRole(
    survey: OnboardingSurveyJson,
    roleName: string,
  ): (RoleplayChat & { chatId?: string }) | undefined {
    return (survey.roleplayChats ?? []).find(
      (c) => c.roleName === roleName,
    ) as (RoleplayChat & { chatId?: string }) | undefined;
  }

  /** 按 chatId 查找对话 */
  private findChatById(
    survey: OnboardingSurveyJson,
    chatId: string,
  ): (RoleplayChat & { chatId?: string }) | undefined {
    return (survey.roleplayChats ?? []).find(
      (c) => (c as unknown as { chatId?: string }).chatId === chatId,
    ) as (RoleplayChat & { chatId?: string }) | undefined;
  }

  /** 持久化 surveyJson 到 OnboardingSession */
  private async persistSurvey(
    sessionId: string,
    survey: OnboardingSurveyJson,
  ): Promise<void> {
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        surveyJson: survey as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** 根据用户性别解析 system prompt 中的占位符（如 {FRIEND_TERM}） */
  private resolveGenderPrompt(
    prompt: string,
    survey: OnboardingSurveyJson,
  ): string {
    const gender = survey.identity?.genderIdentity ?? 'unspecified';
    const friendTerm =
      gender === 'male' ? '兄弟' : gender === 'female' ? '姐妹' : '朋友';
    return prompt.replace(/\{FRIEND_TERM\}/g, friendTerm);
  }

  /** 构建角色上下文注入（优先使用 Phase 1.7 个性化档案，fallback 到画像） */
  private buildPersonaContext(
    survey: OnboardingSurveyJson,
    roleName: RoleName,
  ): string {
    const id = survey.identity;
    const name = id?.displayName ?? '用户';

    // — 优先：Phase 1.7 个性化角色档案 —
    const agentProfile = survey.agentProfiles?.[roleName];
    if (agentProfile) {
      const parts = [
        `【关于你（${roleName}）的个性化设定 — 请自然地融入对话，不要生硬引用】`,
        `你的性格：${agentProfile.personality}`,
        `你的说话风格：${agentProfile.speechStyle}`,
        `你和${name}的共同背景：${agentProfile.sharedContext}`,
        `你们的关系模式：${agentProfile.relationshipDynamics}`,
      ];
      if (agentProfile.topicAffinity?.length) {
        parts.push(`容易产生共鸣的话题：${agentProfile.topicAffinity.join('、')}`);
      }

      // 阿辰额外注入画像原文 + 矛盾标记（因为之前有过好感，了解对方）
      if (roleName === 'disappointed' && survey.personaSketch) {
        parts.push(`\n【${name}的人格画像摘要 — 你可以自然地引用，因为你之前确实了解过TA】`);
        parts.push(survey.personaSketch.narrative);
        if (survey.personaSketch.sections?.contradictions?.trim()) {
          parts.push(
            `\n【${name}的内在矛盾 — 在适当时机自然地追问】\n${survey.personaSketch.sections.contradictions}`,
          );
        }
      }

      return parts.join('\n');
    }

    // — Fallback：Phase 1.5 画像 —
    const sketch = survey.personaSketch;
    if (!sketch) return '';

    // 阿辰：注入完整画像摘要（因为之前有过好感，了解对方）
    if (roleName === 'disappointed') {
      let ctx =
        `【你认识的${name} — 来自画像的参考信息，你可以自然地引用】\n` +
        `${sketch.narrative}`;
      if (sketch.sections?.contradictions?.trim()) {
        ctx += `\n\n【${name}的内在矛盾 — 在适当时机自然地追问，不要生硬引用】\n${sketch.sections.contradictions}`;
      }
      return ctx;
    }

    // 其他角色：只注入简要特征
    const sections = sketch.sections;
    const parts = [`【关于${name}的一些特征，帮助你更自然地对话】`];
    if (!sections) return parts.join('\n');
    if (sections.personalityTexture) {
      parts.push(`性格：${sections.personalityTexture.slice(0, 80)}`);
    }
    if (sections.caringStyle) {
      parts.push(`关心方式：${sections.caringStyle.slice(0, 60)}`);
    }
    if (survey.interests?.length) {
      parts.push(`兴趣：${survey.interests.join('、')}`);
    }
    return parts.join('\n');
  }

  /** 检测是否需要触发"分享脆弱"（对话 >6 轮且助手消息中无脆弱信号） */
  private shouldShareVulnerability(
    messages: Array<{ role: string; content: string }>,
  ): boolean {
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
    if (assistantMsgs.length < 6) return false;

    const vulnerabilityKeywords = [
      '其实我',
      '说实话',
      '我有时候',
      '我最近也有点',
      '其实',
      '我也',
      '坦白说',
      '不瞒你说',
      '我其实',
      '最近有点',
      '迷茫',
      '累',
      '不确定',
      '烦',
      '焦虑',
    ];

    const hasVulnerability = assistantMsgs.some((m) =>
      vulnerabilityKeywords.some((kw) => m.content.includes(kw)),
    );

    return !hasVulnerability;
  }

  /** 检测消息是否为告别语 */
  private isFarewell(text: string): boolean {
    const keywords = [
      '晚安', '拜拜', '回聊', '下次聊', '先这样', '我去',
      '撤了', '下了', '不聊了', '睡觉了', '睡了', '困了',
      '先走', '先去忙', '改天', '88', '再见',
    ];
    return keywords.some((kw) => text.includes(kw));
  }

  /** 检测 agent 最近的消息是否已经告别 */
  private agentSaidFarewell(
    messages: Array<{ role: string; content: string }>,
  ): boolean {
    const recentAssistant = messages
      .filter((m) => m.role === 'assistant')
      .slice(-3);
    return recentAssistant.some((m) => this.isFarewell(m.content));
  }

  /** 把回复拆成 2-3 段（模拟分段发送） */
  private splitIntoSegments(text: string): string[] {
    // 尝试在自然断句处拆分
    const breakPoints: number[] = [];
    const breakChars = ['。', '！', '？', '…', '.'];

    for (let i = 0; i < text.length; i++) {
      if (breakChars.includes(text[i])) {
        breakPoints.push(i + 1);
      }
    }

    if (breakPoints.length === 0) {
      // 无自然断句：整条发送，不强行拆分
      return [text.trim()].filter(Boolean);
    }

    // 选最佳拆分点（接近 1/3 和 2/3 处）
    const len = text.length;
    const ideal1 = len / 3;
    const ideal2 = (len * 2) / 3;

    const split1 = this.closestTo(breakPoints, ideal1);
    const split2 = this.closestTo(
      breakPoints.filter((p) => p > split1),
      ideal2,
    );

    const segments: string[] = [];
    let prev = 0;
    if (split1 > 0 && split1 < len) {
      segments.push(text.slice(prev, split1).trim());
      prev = split1;
    }
    if (split2 > split1 && split2 < len) {
      segments.push(text.slice(prev, split2).trim());
      prev = split2;
    }
    const last = text.slice(prev).trim();
    if (last) segments.push(last);

    return this.mergeShortSegments(segments.filter((s) => s.length > 0));
  }

  /** 合并过短片段（<5 字）到上一条，防止碎片气泡 */
  private mergeShortSegments(segments: string[]): string[] {
    const merged: string[] = [];
    for (const s of segments) {
      if (s.length < 5 && merged.length > 0) {
        merged[merged.length - 1] += s;
      } else {
        merged.push(s);
      }
    }
    return merged.length > 0 ? merged : segments;
  }

  /** 在有序数组中找最接近 target 的值 */
  private closestTo(sorted: number[], target: number): number {
    if (sorted.length === 0) return -1;
    let best = sorted[0];
    let bestDist = Math.abs(best - target);
    for (const v of sorted) {
      const dist = Math.abs(v - target);
      if (dist < bestDist) {
        best = v;
        bestDist = dist;
      }
    }
    return best;
  }

  /** 为分段发送生成一条角色化 follow-up */
  private generateFollowUp(roleName: RoleName): string | null {
    const followUps: Record<RoleName, string[]> = {
      stranger: ['哈哈', '是吗', '对了对了', '嗯'],
      bestfriend: [
        '对了对了！！',
        '啊还有',
        '哦哦哦',
        '哈哈哈哈哈',
        '笑死',
        '你知道吗',
      ],
      crush: ['嗯', '其实没什么', '是吗', '…嗯'],
      disappointed: ['那个', '其实', '嗯', '对了'],
    };
    const pool = followUps[roleName];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** 注入打字错误：用同音字替换（模拟拼音输入法选错字）。
   *  无匹配时返回 null，不强行注入。 */
  private injectTypo(text: string): {
    mainText: string;
    correction: string;
  } | null {
    const chars = [...text];

    // 收集文本中所有可替换的同音字位置
    const matches: { idx: number; original: string; replacement: string }[] = [];
    for (let i = 0; i < chars.length; i++) {
      const alternatives = HOMOPHONE_MAP[chars[i]];
      if (alternatives?.length) {
        const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
        matches.push({ idx: i, original: chars[i], replacement });
      }
    }

    if (matches.length === 0) return null;

    const pick = matches[Math.floor(Math.random() * matches.length)];
    const typoChars = [...chars];
    typoChars[pick.idx] = pick.replacement;
    return {
      mainText: typoChars.join(''),
      correction: pick.original,
    };
  }

  /** 黑名单二次检测仍不通过时的安全兜底回复 */
  private fallbackReply(roleName: RoleName): string {
    const fallbacks: Record<RoleName, string[]> = {
      stranger: ['哈哈是吗', '嗯嗯，然后呢', '哦这样啊'],
      bestfriend: [
        '啊？真的吗！！',
        '然后呢然后呢',
        '你快说快说',
      ],
      crush: ['嗯', '是吗', '然后呢'],
      disappointed: [
        '嗯',
        '在吗',
        '那个',
      ],
    };
    const pool = fallbacks[roleName];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** 解析 LLM 输出的 StyleProfile JSON */
  private parseStyleProfileJson(raw: string): StyleProfile {
    // 去掉可能的 markdown 代码块包裹
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      // 基本结构校验
      if (!parsed.baselineParams || !parsed.relationSwitchRules) {
        throw new Error('Missing required fields');
      }
      return parsed as StyleProfile;
    } catch (err) {
      this.logger.warn(
        `Failed to parse style profile JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
      // 返回安全默认值
      return {
        baselineParams: {
          avgReplyLength: 15,
          sentenceLengthDist: {
            short_under10: 0.3,
            medium_10to25: 0.5,
            long_over25: 0.2,
          },
          emojiDensity: 0.5,
          punctuationHabits: {
            period: 0.4,
            ellipsis: 0.2,
            exclamation: 0.1,
            question: 0.1,
            comma: 0.2,
          },
          topCatchphrases: [],
          commonParticles: [],
        },
        relationSwitchRules: {},
        emotionalReactionPatterns: {},
        boundaries: [],
      };
    }
  }

  /** 解析 LLM 输出的 AgentProfiles JSON */
  private parseAgentProfilesJson(
    raw: string,
  ): Omit<AgentProfiles, 'generationTimestamp'> {
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      // 至少需要一个角色档案
      const hasAny = ['stranger', 'bestfriend', 'crush', 'disappointed'].some(
        (k) => parsed[k]?.personality,
      );
      if (!hasAny) {
        throw new Error('No valid agent profiles found');
      }
      return parsed;
    } catch (err) {
      this.logger.warn(
        `Failed to parse agent profiles JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
      // 返回空档案（前端会继续 fallback 到画像）
      return {};
    }
  }

  /** 生成可读 style.md 文本 */
  private buildStyleMd(profile: StyleProfile): string {
    const lines: string[] = ['# 语言风格档案', ''];

    lines.push('## 基线参数');
    lines.push(`- 平均回复长度: ${profile.baselineParams.avgReplyLength} 字`);
    const dist = profile.baselineParams.sentenceLengthDist;
    lines.push(
      `- 句长分布: 短(<10字) ${(dist.short_under10 ?? 0 * 100).toFixed(0)}% / 中(10-25字) ${(dist.medium_10to25 ?? 0 * 100).toFixed(0)}% / 长(>25字) ${(dist.long_over25 ?? 0 * 100).toFixed(0)}%`,
    );
    lines.push(
      `- Emoji 密度: ${profile.baselineParams.emojiDensity}/条`,
    );
    const punct = profile.baselineParams.punctuationHabits;
    const punctParts: string[] = [];
    if (punct.period) punctParts.push(`句号 ${(punct.period * 100).toFixed(0)}%`);
    if (punct.ellipsis) punctParts.push(`省略号 ${(punct.ellipsis * 100).toFixed(0)}%`);
    if (punct.exclamation) punctParts.push(`感叹号 ${(punct.exclamation * 100).toFixed(0)}%`);
    if (punct.question) punctParts.push(`问号 ${(punct.question * 100).toFixed(0)}%`);
    if (punct.comma) punctParts.push(`逗号 ${(punct.comma * 100).toFixed(0)}%`);
    if (punctParts.length) lines.push(`- 标点习惯: ${punctParts.join(' / ')}`);
    if (profile.baselineParams.topCatchphrases?.length) {
      lines.push(
        `- 口头禅 Top 5: ${profile.baselineParams.topCatchphrases.join(' / ')}`,
      );
    }
    if (profile.baselineParams.commonParticles?.length) {
      lines.push(
        `- 常见语气词: ${profile.baselineParams.commonParticles.join(' / ')}`,
      );
    }

    lines.push('');
    lines.push('## 关系切换规则');
    for (const [role, desc] of Object.entries(
      profile.relationSwitchRules,
    )) {
      if (desc) lines.push(`- ${role}: ${desc}`);
    }

    lines.push('');
    lines.push('## 情绪反应模式');
    for (const [trigger, pattern] of Object.entries(
      profile.emotionalReactionPatterns,
    )) {
      if (pattern) lines.push(`- ${trigger}: ${pattern}`);
    }

    if (profile.boundaries?.length) {
      lines.push('');
      lines.push('## 用户回避的话题/表达');
      for (const b of profile.boundaries) {
        lines.push(`- ${b}`);
      }
    }

    return lines.join('\n');
  }

  /** 生成短 UUID */
  private generateId(): string {
    return (
      'rp_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10)
    );
  }

  /** Math.random 封装（方便测试时 mock） */
  private rand(): number {
    return Math.random();
  }
}
