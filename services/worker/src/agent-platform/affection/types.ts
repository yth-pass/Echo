export type RelationshipLabel =
  | 'stranger'
  | 'acquaintance'
  | 'friendly_acquaintance'
  | 'good_terms'
  | 'close'
  | 'strained'
  | 'distant'
  | 'friendly_but_cautious';

/**
 * EventStrength 表示事件对关系影响的强度。
 * - weak: 轻微、常规的互动（例如日常寒暄、普通感谢）
 * - moderate: 正常强度的关系信号（默认值）
 * - strong: 强烈、显著的关系事件（例如重大信任崩塌、深度情感表态）
 * 强度会直接影响 delta 幅度计算（point 2 核心机制）。
 */
export type EventStrength = 'weak' | 'moderate' | 'strong';

/** Distinguishes short-term friction from deep, persistent distrust. */
export type TensionQuality = 'situational' | 'structural';

export interface AffectionDimensions {
  familiarity: number;
  warmth: number;
  trust: number;
  tension: number;
  tension_quality: TensionQuality;
}

export const DEFAULT_AFFECTION_DIMENSIONS: AffectionDimensions = {
  familiarity: 0,
  warmth: 0,
  trust: 0,
  tension: 0,
  tension_quality: 'situational',
};

/** Tracks trust repair arc after trust_break events. */
export interface TrustRepairArc {
  trust_break_count: number;
  positive_interactions_since_break: number;
  is_in_repair_arc: boolean;
}

export const DEFAULT_REPAIR_ARC: TrustRepairArc = {
  trust_break_count: 0,
  positive_interactions_since_break: 0,
  is_in_repair_arc: false,
};

export interface AffectionState {
  other_agent_id: string;
  dimensions: AffectionDimensions;
  composite_affinity: number;
  relationship_label: RelationshipLabel;
  repair_arc?: TrustRepairArc;
  last_interaction_at?: string;
  last_updated_at: string;
  version: number;
}

export type AffectionEventType =
  | 'positive_engagement'
  | 'compliment'
  | 'helpful_share'
  | 'agreement'
  | 'conflict'
  | 'insult_or_rude'
  | 'apology_or_repair'
  | 'trust_confirm'
  | 'trust_break'
  | 'deep_share'
  | 'collaborative_success'
  | 'support_received'
  | 'support_given'
  | 'explicit_bond'
  | 'session_contact'
  | 'value_alignment'
  | 'preference_match';

/** Maps event_type to tension quality when the event produces positive tension delta. */
export const TENSION_QUALITY_RULES: Partial<Record<AffectionEventType, TensionQuality>> = {
  conflict: 'situational',
  insult_or_rude: 'structural',
  trust_break: 'structural',
};

export interface AffectionEvent {
  id: string;
  observer_id: string;
  other_id: string;
  event_type: AffectionEventType;
  deltas: Partial<AffectionDimensions>;
  evidence?: {
    joint_session_id?: string;
    turn_ids?: number[];
    span?: string;
    topic_id?: string;
    /**
     * strength: 事件强度，影响 delta 幅度与 cap 计算。
     * 提取时 LLM 必须输出；若缺失，AffectionApplyService 将默认使用 'moderate'。
     * 必填语义（point 2 增强后）。
     */
    strength: EventStrength;
    [key: string]: any;
  };
  confidence?: number;
  at: string;
  correlation_id?: string;
}

export interface ApplyResult {
  before: AffectionState;
  after: AffectionState;
  appliedEvents: AffectionEvent[];
  skippedEvents: AffectionEvent[];
  labelChanged: boolean;
}
