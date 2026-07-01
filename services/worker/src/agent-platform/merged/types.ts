/**
 * Unified analysis types (REQ-08).
 *
 * A single LLM JSON-mode call replaces the separate TopicJudge,
 * SocialExtract (×2), and RelationshipExtract (×2) calls.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Topic sub-section (was TopicJudge output)
// ---------------------------------------------------------------------------

export interface UnifiedTopic {
  /** Transition type — same semantics as TopicJudgeOutput.transition */
  transition:
    | 'continue_main'
    | 'continue_sub'
    | 'new_sub'
    | 'return_to_main'
    | 'new_main';
  /** 0–1 confidence for the transition decision */
  confidence: number;
  /** Human-readable reason string */
  reason?: string;
  /** Updated label/summary for the current main topic */
  main_topic_update?: {
    label?: string;
    summary?: string; // ≤150 chars
  };
  /** Subtopic create / update action */
  subtopic?: {
    action: 'create' | 'update';
    label: string;
    summary?: string; // ≤150 chars
    return_hint?: string;
  };
  /** Subtopic closure payload */
  subtopic_close?: {
    topic_id: string;
    final_summary?: string; // ≤150 chars
    valence?: 'positive' | 'neutral' | 'negative';
  };
  /** New main topic (new_main transition) */
  new_main_topic?: {
    label: string;
    summary?: string; // ≤150 chars
  };
}

// ---------------------------------------------------------------------------
// Social sub-section (was SocialExtract output)
// ---------------------------------------------------------------------------

export interface UnifiedSocialFact {
  agent_id: string;
  observer_relative: {
    preference?: string;
    dislike?: string;
    habit?: string;
    other_tag?: string;
    confidence?: number;
  };
}

export interface UnifiedSocial {
  /** Facts observed about each participant */
  facts: UnifiedSocialFact[];
  /** Freeform tags (hobbies, personality traits, lifestyle hints) */
  tags: string[];
}

// ---------------------------------------------------------------------------
// Affection sub-section (was RelationshipExtract output)
// ---------------------------------------------------------------------------

export interface UnifiedAffection {
  /** 0.0–1.0 emotional alignment (tone, warmth, empathy) */
  sentiment: number;
  /** 0.0–1.0 topic / interest overlap between participants */
  topic_overlap: number;
  /** 0.0–1.0 value / lifestyle compatibility */
  compatibility: number;
  /** 0.0–1.0 interaction depth (conversation length, question quality) */
  engagement: number;
  /** Optional LLM-written reasoning string */
  reasoning?: string;
  /** New relationship events detected in this turn batch */
  events?: UnifiedAffectionEvent[];
}

export interface UnifiedAffectionEvent {
  event_type:
    | 'positive_engagement'
    | 'compliment'
    | 'helpful_share'
    | 'agreement'
    | 'conflict'
    | 'insult_or_rude'
    | 'apology_or_repair'
    | 'trust_confirm'
    | 'trust_break'
    | 'explicit_bond'
    | 'value_alignment'
    | 'preference_match';
  turn_ids: number[];
  confidence: number;
  strength: 'weak' | 'moderate' | 'strong';
  evidence_span?: string;
}

// ---------------------------------------------------------------------------
// Top-level unified result
// ---------------------------------------------------------------------------

export interface UnifiedAnalysisResult {
  topic: UnifiedTopic;
  social: UnifiedSocial;
  affection: UnifiedAffection;
}
