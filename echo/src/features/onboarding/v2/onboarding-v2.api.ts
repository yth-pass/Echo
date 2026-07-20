/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * v2 入驻流程 — API service 函数
 * 统一走 apiPostJson / unwrap，与现有 api/client.ts 保持一致
 */

import { apiGetJson, apiPostJson, unwrap, type ApiResult } from '../../../api/client';
import { saveTokens, scheduleProactiveRefresh } from '../../../api/auth';
import type {
  Phase0Payload,
  Phase1CardResponse,
  PersonaAdjustment,
  RoleId,
  OnboardingPhase,
  IdealPartnerSketchData,
  IdealPartnerSketchApiResponse,
} from './onboarding-v2.types';

// ─── 进度查询（A1：恢复用，幂等） ─────────────────────────────────────────────

/** GET /onboarding/progress 返回结构 */
export interface OnboardingProgress {
  hasActiveSession: boolean;
  sessionId?: string;
  currentPhase?: OnboardingPhase;
  /** Phase 0 已保存的身份字段（用于跨设备恢复 formData） */
  phase0Data?: Phase0Payload | null;
  /** Phase 1 已保存的卡片回答（用于跨设备恢复 cardIndex/responses） */
  phase1Responses?: Phase1CardResponse[];
  /** Phase 2 已完成的 roleId 列表（用于同步 completedRoles，避免与后端不同步） */
  phase2CompletedRoles?: RoleId[];
}

/**
 * 查询当前用户入驻整体进度。前端 OnboardingShell mount 时调用以支持跨设备/清缓存后恢复。
 * 失败时返回 { hasActiveSession: false } 让调用方降级到 localStorage。
 */
export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const res = await apiGetJson<OnboardingProgress>('/onboarding/progress');
  return res.ok ? res.data : { hasActiveSession: false };
}

// ─── Phase 0 ──────────────────────────────────────────────────────────────────

export async function submitPhase0(
  payload: Phase0Payload,
): Promise<ApiResult<{ sessionId?: string }>> {
  return apiPostJson<Phase0Payload, { sessionId?: string }>(
    '/onboarding/phase0',
    payload,
  );
}

// ─── Phase 1 ──────────────────────────────────────────────────────────────────

export interface SubmitPhase1Body {
  cards: Phase1CardResponse[];
  completionTimestamp?: number;
}

export async function submitPhase1(
  cards: Phase1CardResponse[],
): Promise<ApiResult<{ sessionId?: string }>> {
  const body: SubmitPhase1Body = {
    cards,
    completionTimestamp: Date.now(),
  };
  return apiPostJson<SubmitPhase1Body, { sessionId?: string }>(
    '/onboarding/phase1',
    body,
  );
}

/** AI 生成情境卡片参考答案（"需要灵感"功能） */
export interface Phase1HintResponse {
  hint: string;
}

export async function getPhase1Hint(cardId: string): Promise<string | null> {
  const res = await apiPostJson<{ cardId: string }, Phase1HintResponse>(
    '/onboarding/phase1/hint',
    { cardId },
  );
  return res.ok ? res.data.hint : null;
}

// ─── Phase 1.5 ────────────────────────────────────────────────────────────────

/** 后端 PersonaSketchSections：voiceAnchors 是 string[] */
export interface PersonaSketchApiSections {
  identityNarrative: string;
  personalityTexture: string;
  coreBeliefs: string;
  valuesInAction: string;
  caringStyle: string;
  socialBoundaries: string;
  contradictions: string;
  voiceAnchors: string[];
}

export interface PersonaSketchData {
  narrative: string;
  sections: PersonaSketchApiSections;
  generationTimestamp: number;
}

/** 后端实际返回：{ success, personaSketch } */
export interface PersonaSketchApiResponse {
  success: boolean;
  personaSketch: PersonaSketchData;
}

export async function generatePersonaSketch(): Promise<ApiResult<PersonaSketchData>> {
  const result = await apiPostJson<Record<string, never>, PersonaSketchApiResponse>(
    '/onboarding/persona-sketch/generate',
    {} as Record<string, never>,
  );
  if (result.ok) {
    return { ok: true, data: result.data.personaSketch };
  }
  // error 分支不含 data，安全转换泛型
  return result as ApiResult<PersonaSketchData>;
}

export async function adjustPersonaSketch(
  adjustment: PersonaAdjustment,
): Promise<ApiResult<PersonaSketchData>> {
  const result = await apiPostJson<PersonaAdjustment, PersonaSketchApiResponse>(
    '/onboarding/persona-sketch/adjust',
    adjustment,
  );
  if (result.ok) {
    return { ok: true, data: result.data.personaSketch };
  }
  return result as ApiResult<PersonaSketchData>;
}

/** 批量句子级修正：传入所有 (原句 → 修正) 对，后端用 LLM 重新生成 */
export interface SentenceCorrection {
  sectionKey: string;
  originalSentence: string;
  correctedSentence: string;
}

export interface BatchAdjustBody {
  corrections: SentenceCorrection[];
}

export async function batchAdjustPersonaSketch(
  corrections: SentenceCorrection[],
): Promise<ApiResult<PersonaSketchData>> {
  const result = await apiPostJson<BatchAdjustBody, PersonaSketchApiResponse>(
    '/onboarding/persona-sketch/batch-adjust',
    { corrections },
  );
  if (result.ok) {
    return { ok: true, data: result.data.personaSketch };
  }
  return result as ApiResult<PersonaSketchData>;
}

// ─── Phase 1.6 ────────────────────────────────────────────────────────────────

export async function generateIdealPartnerSketch(): Promise<ApiResult<IdealPartnerSketchData>> {
  const result = await apiPostJson<Record<string, never>, IdealPartnerSketchApiResponse>(
    '/onboarding/ideal-partner-sketch/generate',
    {} as Record<string, never>,
  );
  if (result.ok) {
    return { ok: true, data: result.data.idealPartnerSketch };
  }
  return result as ApiResult<IdealPartnerSketchData>;
}

export async function adjustIdealPartnerSketch(
  userFeedback: string,
): Promise<ApiResult<IdealPartnerSketchData>> {
  const result = await apiPostJson<{ userFeedback: string }, IdealPartnerSketchApiResponse>(
    '/onboarding/ideal-partner-sketch/adjust',
    { userFeedback },
  );
  if (result.ok) {
    return { ok: true, data: result.data.idealPartnerSketch };
  }
  return result as ApiResult<IdealPartnerSketchData>;
}

// ─── Phase 2 ──────────────────────────────────────────────────────────────────

/**
 * POST /onboarding/roleplay/start 返回结构（A3 改造：新增 status / existingMessages / endedReason）。
 *
 * 调用方必须根据 status 字段决定行为：
 *   - status='active' → 正常初始化 conversation，进入聊天屏
 *   - status='ended'  → 该角色对话已结束，应标记为 completedRoles 并停留角色屏
 */
export interface RoleplayStartResponse {
  chatId: string;
  openingMessage: string;
  agentName: string;
  /** chat 当前状态：active=可继续聊，ended=已结束 */
  status: 'active' | 'ended';
  /** 当 status='ended' 时返回历史消息，让前端可展示 */
  existingMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  /** 当 status='ended' 时返回结束原因 */
  endedReason?: 'manual' | 'auto_farewell';
}

export async function startRoleplay(
  roleName: RoleId,
): Promise<RoleplayStartResponse | null> {
  const res = await apiPostJson<{ roleName: RoleId }, RoleplayStartResponse>(
    '/onboarding/roleplay/start',
    { roleName },
  );
  return unwrap(res);
}

/**
 * GET /onboarding/roleplay/chats 返回的单条 chat 概要（A2 新增）。
 * 前端 Phase2Roleplay mount 时调用以同步 completedRoles，避免 localStorage 与后端不同步。
 */
export interface RoleplayChatSummary {
  chatId: string;
  roleName: RoleId;
  agentName: string;
  /** active=可继续聊，ended=已结束 */
  status: 'active' | 'ended';
  messageCount: number;
  startedAt: number;
  endedAt: number;
  /** 结束原因：manual=用户点结束按钮，auto_farewell=双方告别自动结束 */
  endedReason?: 'manual' | 'auto_farewell';
}

/**
 * 列出当前用户所有 roleplay chat 的状态概要。
 * 失败时返回空数组，让调用方降级到 localStorage。
 */
export async function listRoleplayChats(): Promise<RoleplayChatSummary[]> {
  const res = await apiGetJson<{ chats: RoleplayChatSummary[] }>('/onboarding/roleplay/chats');
  return res.ok ? res.data.chats : [];
}

export interface RoleplayReplyMessage {
  content: string;
  delayMs: number;
  isTypoCorrection: boolean;
}

export interface RoleplayTurnResponse {
  replies: RoleplayReplyMessage[];
  ended?: boolean;
}

export async function sendRoleplayTurn(
  chatId: string,
  message: string,
  signal?: AbortSignal,
): Promise<ApiResult<RoleplayTurnResponse>> {
  return apiPostJson<
    { chatId: string; message: string },
    RoleplayTurnResponse
  >('/onboarding/roleplay/turn', { chatId, message }, signal);
}

export async function endRoleplay(chatId: string): Promise<boolean> {
  const res = await apiPostJson<{ chatId: string }, unknown>(
    '/onboarding/roleplay/end',
    { chatId },
  );
  return unwrap(res) !== null;
}

export interface ExtractStyleResponse {
  styleProfile: Record<string, unknown>;
  styleMd: string;
}

export async function extractRoleplayStyle(): Promise<ExtractStyleResponse | null> {
  const res = await apiPostJson<Record<string, never>, ExtractStyleResponse>(
    '/onboarding/roleplay/extract-style',
    {} as Record<string, never>,
  );
  return unwrap(res);
}

// ─── Phase 1.7: 个性化角色档案 ──────────────────────────────────────────────

export interface AgentProfileData {
  personality: string;
  speechStyle: string;
  sharedContext: string;
  relationshipDynamics: string;
  topicAffinity: string[];
}

export interface AgentProfilesResponse {
  agentProfiles: {
    stranger?: AgentProfileData;
    bestfriend?: AgentProfileData;
    crush?: AgentProfileData;
    disappointed?: AgentProfileData;
    generationTimestamp?: number;
  };
}

export async function generateAgentProfiles(): Promise<AgentProfilesResponse | null> {
  const res = await apiPostJson<Record<string, never>, AgentProfilesResponse>(
    '/onboarding/roleplay/generate-profiles',
    {} as Record<string, never>,
  );
  return unwrap(res);
}

// ─── Finalize ──────────────────────────────────────────────────────────────────

export interface FinalizeResponse {
  cloneId?: string;
  onboardingComplete?: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
}

export async function finalizeOnboarding(): Promise<ApiResult<FinalizeResponse>> {
  const res = await apiPostJson<Record<string, never>, FinalizeResponse>(
    '/onboarding/finalize',
    {} as Record<string, never>,
  );
  if (res.ok && res.data?.accessToken) {
    saveTokens({
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      userId: res.data.userId ?? '',
    });
    scheduleProactiveRefresh();
  }
  return res;
}
