import { chat } from '../../clone-runtime/llm';
import type { CurrentTopic, TopicJudgeOutput, Transition } from './types';

const JUDGE_PROMPT = `你是 Echo 的 TopicJudge。严格根据以下规则判断对话 transition（5 种之一），并输出 JSON（仅 JSON，无解释）。

规则（必须遵守）：
- continue_main：仍在主线，更新 main_topic.summary（≤150 字）。
- continue_sub：仍在当前 subtopic，更新 active_subtopic.summary。
- new_sub：从 main 偏离（或 sub 内新 sub，MVP 先关闭旧 sub 入 history），设置 active_subtopic，focus=sub，主线不变。
- return_to_main：子话题自然结束，将 active_subtopic 移入 subtopic_history，active_subtopic=null，focus=main，可选更新 main summary。
- new_main：整个对话主题改变，将完整 current_topic 归档到 topic_history，然后重置新 main_topic。

额外规则（opening 阶段必须遵守，L6 memory 优先级最高）：
- 当 current_topic.main_topic.phase === 'opening'（打招呼/开场阶段）
- **如果 known_social_memory 中已有姓名（name）或职业（occupation），则视为信息已收集，禁止仅因 opening 规则而强制 continue_main**，必须允许自然过渡（new_sub / return_to_main / continue_sub）。
- 只有当 known_social_memory 中完全没有姓名和职业时，才必须优先收集姓名和年龄。
- 在 opening 阶段，如果 known_social_memory 中已有姓名或职业，summary 应体现“已知对方姓名XX/职业XX，继续自然交谈”。
- main_topic_update.summary 应优先体现“已知对方信息，继续自然过渡”或“正在询问对方姓名和年龄”。

输入：
- current_topic: {main_topic, active_subtopic, subtopic_history, focus}
- last_turns: 最近 3-5 轮消息
- new_message: 当前用户消息
- known_social_memory: 可选，L6 检索到的已知对方属性（name, age, city, occupation 等）

输出必须符合：
{
  "transition": "continue_main|continue_sub|new_sub|return_to_main|new_main",
  "confidence": 0.0-1.0,
  "reason": "简短理由",
  "main_topic_update": {"summary": "≤150字更新"},
  "subtopic": {"action":"create|update", "label":"...", "summary":"≤150字"},
  "subtopic_close": {"topic_id":"...", "final_summary":"≤150字", "valence":"positive|neutral|negative"},
  "new_main_topic": {"label":"...", "summary":"≤150字"}
}

仅当字段相关时填充，否则省略。summary 严格 ≤150 字符。`;

export class TopicJudgeService {
  async judge(
    currentTopic: CurrentTopic,
    lastTurns: Array<{ role: string; content: string }>,
    newMessage: string,
    knownSocialMemory?: Record<string, string>,
  ): Promise<TopicJudgeOutput> {
    const input = JSON.stringify({
      current_topic: currentTopic,
      last_turns: lastTurns,
      new_message: newMessage,
      known_social_memory: knownSocialMemory ?? {},
    });

    const raw = await chat([
      { role: 'system', content: JUDGE_PROMPT },
      { role: 'user', content: input },
    ]);

    try {
      // 【缺陷4适配】chat() 可能返回 null（LLM 失败），走 catch 返回 fallback
      if (!raw) throw new Error('LLM returned null');
      const parsed = JSON.parse(raw.trim().replace(/```json|```/g, '')) as TopicJudgeOutput;
      // basic validation
      if (!parsed.transition || typeof parsed.confidence !== 'number') {
        throw new Error('invalid output');
      }
      return parsed;
    } catch {
      // fallback: continue_main with minimal update
      return {
        transition: 'continue_main',
        confidence: 0.5,
        reason: 'fallback due to parse error',
        main_topic_update: { summary: newMessage.slice(0, 140) },
      };
    }
  }
}

// NOTE: PromoteCheckService is NOT called inside TopicJudgeService.
// The actual trigger lives in the agent-turn handler (main.ts) after TopicJudge returns `return_to_main` or `new_main`.

