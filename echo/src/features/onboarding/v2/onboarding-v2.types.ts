/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * v2 入驻流程 — 全部类型定义
 * 字段名与后端 DTO（services/api/src/onboarding/onboarding.dto.ts）保持对齐
 */

// ─── Phase 状态机 ──────────────────────────────────────────────────────────────

export type OnboardingPhase = 'phase0' | 'phase1' | 'phase1_5' | 'phase1_6' | 'phase2' | 'finalize';

export const PHASE_ORDER: OnboardingPhase[] = [
  'phase0',
  'phase1',
  'phase1_5',
  'phase1_6',
  'phase2',
  'finalize',
];

// ─── Phase 0: 渐进式名片 ──────────────────────────────────────────────────────

export type GenderOption = 'male' | 'female' | 'nonbinary' | 'unspecified';
export type AgeBand = '18-22' | '23-27' | '28-32' | '33-38' | '39-45' | '46+';
export type EducationLevel =
  | 'highschool'
  | 'college'
  | 'bachelor'
  | 'master'
  | 'phd';

export interface FamilyMember {
  relation: 'father' | 'mother' | 'sibling' | 'partner' | 'other';
  brief: string;
}

export interface Phase0Payload {
  displayName: string;
  preferredAddress: string;
  genderIdentity: GenderOption;
  ageBand: AgeBand;
  hometownCity: string;
  currentCity: string;
  education: EducationLevel;
  occupation: string;
  industry: string;
  /** 创业时选择的细分领域 */
  entrepreneurshipField?: string;
  workDescription: string;
  keyLifeExperiences: string[];
  selfIntroOneLiner: string;
  goalOnEcho?: string;
  familyMembers?: FamilyMember[];
  /** 匹配偏好 / 理想型 */
  matchPreference?: MatchPreference;
}

export type Phase0FieldInputType =
  | 'text'
  | 'choice'
  | 'autocomplete'
  | 'textarea'
  | 'tag-input'
  | 'family-input';

export interface Phase0ChoiceOption {
  value: string;
  label: string;
}

export interface Phase0FieldDef {
  key: string;
  label: string;
  subtitle?: string;
  required: boolean;
  inputType: Phase0FieldInputType;
  choices?: Phase0ChoiceOption[];
  maxLength?: number;
  /** 推荐最少字数（显示给用户，代替纯上限提示） */
  recommendedMin?: number;
  minItems?: number;
  maxItems?: number;
  itemMaxLength?: number;
  placeholder?: string;
  skipLabel?: string;
  /** autocomplete 候选列表 */
  suggestions?: string[];
  /** 条件显示：仅当另一字段取某值时才显示 */
  showWhen?: { field: string; value: string };
  /** 输入框下方的回声小字（14px，灰色 #9b95a8），填空白区 */
  echoHint?: string;
}

/** 匹配偏好 / 理想型 */
export interface MatchPreference {
  preferredGender?: 'male' | 'female' | 'any';
  preferredAgeBand?: string[];
  preferredCity?: string;
  preferredOccupation?: string[];
}

// ─── Phase 1: 情境卡片 ────────────────────────────────────────────────────────

export interface ScenarioCardOption {
  optionId: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface ScenarioCardDef {
  cardId: string;
  scenarioText: string;
  illustrationKey: string;
  options: ScenarioCardOption[];
  allowCustomText: boolean;
  requiredFreeText: boolean;
  freeTextMaxLength: number;
}

export interface Phase1CardResponse {
  cardId: string;
  choice: 'A' | 'B' | 'C' | 'D' | 'custom';
  freeText?: string;
  responseTimeMs: number;
}

// ─── Phase 1.5: 人格画像 ──────────────────────────────────────────────────────

export type SectionKey =
  | 'identityNarrative'
  | 'personalityTexture'
  | 'coreBeliefs'
  | 'valuesInAction'
  | 'caringStyle'
  | 'socialBoundaries'
  | 'contradictions'
  | 'voiceAnchors';

export const SECTION_META: Record<SectionKey, { icon: string; title: string }> = {
  identityNarrative: { icon: '🧭', title: '身份脉络' },
  personalityTexture: { icon: '🎨', title: '性格底色' },
  coreBeliefs: { icon: '💎', title: '核心信念' },
  valuesInAction: { icon: '⚖️', title: '价值观' },
  caringStyle: { icon: '❤️', title: '关心方式' },
  socialBoundaries: { icon: '🛡️', title: '社交边界' },
  contradictions: { icon: '🔄', title: '内在矛盾' },
  voiceAnchors: { icon: '🎤', title: '语言锚点' },
};

export interface PersonaSketchSection {
  key: SectionKey;
  narrative: string;
}

export interface PersonaSketchData {
  narrative: string;
  sections: PersonaSketchSection[];
  generationTimestamp: string;
}

export interface PersonaAdjustment {
  section: SectionKey;
  userCorrection: string;
}

// ─── Phase 1.6: 理想伴侣画像 ──────────────────────────────────────────────────

export interface IdealPartnerSketchDimensions {
  emotionalSafety: number;
  spaceRespect: number;
  directCommunication: number;
  conflictResolution: number;
}

export interface IdealPartnerSketchData {
  narrative: string;
  dimensions: IdealPartnerSketchDimensions;
  userFeedback?: string;
  generatedAt: string;
}

export interface IdealPartnerSketchApiResponse {
  success: boolean;
  idealPartnerSketch: IdealPartnerSketchData;
}

// ─── Phase 2: 角色扮演 ────────────────────────────────────────────────────────

export type RoleId = 'stranger' | 'bestfriend' | 'crush' | 'disappointed';

export interface RoleAgentDef {
  roleId: RoleId;
  displayName: string;
  description: string;
  availableInP0: boolean;
  unlockLabel?: string;
  avatarUrl?: string;
  /** 文字头像：单字或双字（优先于 avatarUrl） */
  avatarText?: string;
  /** 头像背景色（HEX） */
  avatarColor?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  segments: string[];
  /** 已经显示了多少 segment */
  displayedSegments: number;
  timestamp: number;
  /**
   * 消息实际可见的时间（用于渲染排序）。
   * - user 消息: push 时 = Date.now()（发送时间）
   * - assistant 消息: 揭示时（setTimeout 触发）= Date.now()
   * - 历史消息恢复: 兜底用 timestamp
   */
  displayedAt: number;
}

export interface RoleplayConversation {
  roleId: RoleId;
  chatId: string;
  messages: ChatMessage[];
  turnCount: number;
  status: 'active' | 'ended';
  /**
   * 尚未视觉展示的 assistant 消息 ID 集合（C 修复新增）。
   *
   * 设计原理：把"消息存在性"（messages 数组）和"消息可见性"（pendingDisplayIds）
   * 绑定在同一个对象上，避免双 state 不同步：
   *   - API 返回的 N 条 assistant 消息被一次性加入 messages
   *   - 真正"逐条显示"靠 pendingDisplayIds 控制可见性 + setTimeout 逐个移除
   *   - 退回角色屏 / 退出 onboarding 时 pendingDisplayIds 随 conversation 持久化
   *   - 下次进入时从 localStorage 恢复，自动重启动画
   */
  pendingDisplayIds: Set<string>;
}

// ─── Session 持久化 ────────────────────────────────────────────────────────────

export interface OnboardingSession {
  phase: OnboardingPhase;
  completedPhases: OnboardingPhase[];
  phase1CardIndex?: number;
  phase1Responses?: Phase1CardResponse[];
  phase2CompletedRoles?: RoleId[];
  savedAt: string;
}

// ─── 通用 Phase Props ──────────────────────────────────────────────────────────

export interface PhaseProps {
  onComplete: () => void;
  onError?: (error: string) => void;
  /** 跳回指定阶段并携带错误信息（如 Phase 1.5 发现 Phase 1 数据不完整时） */
  onGoBack?: (targetPhase: OnboardingPhase, errorMessage?: string) => void;
  /** 从上一阶段跳过来时携带的错误信息 */
  initialError?: string;
  /** 关闭/退出入驻流程 */
  onClose?: () => void;
}
