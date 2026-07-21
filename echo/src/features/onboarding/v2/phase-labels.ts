/**
 * Echo Onboarding — Phase 标签体系
 *
 * 提供统一的 Phase 总结性标签（短/全/描述），供 Stepper、弹窗、标题等组件复用。
 * 替代各 phase 组件散落的硬编码标题。
 */

import type { OnboardingPhase } from './onboarding-v2.types';

export interface PhaseLabel {
  /** Stepper 圆圈下方的短标签（≤4 字） */
  short: string;
  /** phase 组件内的完整标题 */
  full: string;
  /** 弹窗/提示中用到的描述性文字 */
  description: string;
}

export const PHASE_LABELS: Record<OnboardingPhase, PhaseLabel> = {
  phase0:   { short: '基础信息', full: '基础信息',     description: '你的身份基座' },
  phase1:   { short: '个人特征', full: '个人特征',     description: '情境中的偏好反应' },
  phase1_5: { short: '人格画像', full: '你的人格画像', description: 'AI 综合的人格速写' },
  phase1_6: { short: '理想型',   full: '你需要什么样的人', description: '理想伙伴画像' },
  phase2:   { short: '角色对话', full: '和 TA 们聊聊',  description: '与四个角色深度对话' },
  finalize: { short: '分身孵化', full: '分身孵化',     description: '生成你的数字分身' },
};

/** 获取某个 phase 的短标签 */
export function getPhaseShortLabel(phase: OnboardingPhase): string {
  return PHASE_LABELS[phase]?.short ?? phase;
}

/** 获取某个 phase 的完整标题 */
export function getPhaseFullLabel(phase: OnboardingPhase): string {
  return PHASE_LABELS[phase]?.full ?? phase;
}
