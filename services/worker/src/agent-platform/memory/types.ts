export interface Turn {
  speaker_id: string;
  content: string;
  turn_index?: number;
}

export interface ObjectiveFact {
  id: string;
  subject_agent_id: string;
  fact: string;
  fact_scope: 'about_self' | 'about_third_party';
  fact_type: 'explicit_statement';
  confidence: number;
  status: 'active' | 'deprecated';
  source: {
    session_id: string;
    speaker_id: string;
    turn_ids: number[];
    quoted_span?: string;
    promoted_from?: string;
  };
  visibility?: string;
  share_policy?: 'never' | 'do_not_repeat_to_subject' | 'ok_if_relevant' | 'public_to_connections';
  extracted_at: string;
  // LLM-populated structured attributes (name, age, city, occupation, etc.)
  attributes?: Record<string, string>;
}

export interface Preference {
  id: string;
  subject_agent_id: string;
  content: string;
  pref_type: 'explicit_opinion' | 'implicit_inferred' | 'stylistic';
  confidence: number;
  status: 'candidate' | 'active' | 'promoted_to_objective' | 'contradicted';
  promoted_to?: string;
  source: {
    session_id: string;
    turn_ids: number[];
  };
  extracted_at: string;
}

export interface ExtractResult {
  objective_facts: ObjectiveFact[];
  preferences: Preference[];
}