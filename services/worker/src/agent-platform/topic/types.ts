// M3 Topic Engine types
// Mirrors docs/agent-platform/schemas/current_topic.schema.json and topic_judge_output.schema.json

export type TopicPhase = 'opening' | 'ongoing' | 'closing';
export type Focus = 'main' | 'sub';
export type Valence = 'positive' | 'neutral' | 'negative';
export type Transition =
  | 'continue_main'
  | 'continue_sub'
  | 'new_sub'
  | 'return_to_main'
  | 'new_main';

export interface Subtopic {
  topic_id: string;
  label: string;
  summary?: string; // ≤150 chars
  phase?: string;
  return_hint?: string;
  started_at?: string;
  last_turn_id?: number;
  turn_count?: number;
}

export interface SubtopicClosed {
  topic_id: string;
  label: string;
  summary?: string; // ≤150 chars
  valence?: Valence;
  started_at?: string;
  ended_at?: string;
  turn_range?: [number, number];
}

export interface MainTopic {
  topic_id: string;
  label: string;
  summary?: string; // ≤150 chars
  phase: TopicPhase;
  subtopics_hint?: string[];
  started_at?: string;
  last_turn_id?: number;
}

export interface CurrentTopic {
  main_topic: MainTopic;
  active_subtopic?: Subtopic | null;
  subtopic_history?: SubtopicClosed[];
  subtopic_stack?: Subtopic[]; // optional for MVP
  focus: Focus;
  meta?: {
    session_id?: string;
    updated_at?: string;
  };
}

export interface TopicJudgeOutput {
  transition: Transition;
  confidence: number; // 0-1
  reason?: string;
  main_topic_update?: {
    label?: string;
    summary?: string; // ≤150 chars
  };
  subtopic?: {
    action: 'create' | 'update';
    label: string;
    summary?: string; // ≤150 chars
    return_hint?: string;
  };
  subtopic_close?: {
    topic_id: string;
    final_summary?: string; // ≤150 chars
    valence?: Valence;
  };
  new_main_topic?: {
    label: string;
    summary?: string; // ≤150 chars
  };
}
