export interface Persona {
  id: string;
  name: string;
  role_title: string;
  avatar_image_url: string;
  voice_id: string;
  language: "he" | "en";
  system_prompt: string;
  created_at: string;
}

export interface PersonaCreatePayload {
  name: string;
  role_title: string;
  avatar_image_url?: string;
  voice_id: string;
  language: "he" | "en";
  system_prompt: string;
}

export interface SessionInitResponse {
  session_id: string;
  provider?: "simli" | "did" | "mock";
  simli_session_token?: string;
  did_stream_id: string;
  did_session_id: string;
  offer: RTCSessionDescriptionInit | null;
  ice_servers: RTCIceServer[];
  mock: boolean;
}

export interface TranscriptMessage {
  speaker: "participant" | "avatar";
  text: string;
  timestamp?: string;
}

export interface SessionSummary {
  session_id: string;
  summary: string;
  action_items: string[];
  template_name?: string | null;
}

export interface MeetingHistoryItem {
  id: string;
  persona_id: string;
  persona_name?: string;
  title: string;
  agenda: string;
  status: string;
  template_name?: string;
  transcript: TranscriptMessage[];
  summary: string | null;
  action_items: string[];
  created_at: string;
}

export interface SummaryTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  instructions: string;
  builtin: boolean;
}

export interface ScheduledMeeting {
  id: string;
  title: string;
  persona_id: string;
  persona_name?: string;
  scheduled_at: string;
  duration_minutes: number;
  agenda: string;
  template_id: string;
  status: string;
}

export interface DashboardStats {
  total_meetings: number;
  ended_meetings: number;
  total_personas: number;
  scheduled_meetings: number;
  total_messages: number;
  total_action_items: number;
  avg_messages_per_meeting: number;
  daily_activity: { date: string; count: number }[];
  persona_breakdown: { name: string; count: number }[];
}

export type BotStatus = "idle" | "transcribing" | "thinking" | "speaking";

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  avatar_image_url: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface StreamMetrics {
  stt_ms: number;
  rag_ms: number;
  llm_ms: number;
  tts_ms: number;
  total_ms: number;
  tokens_used: number;
  llm_provider: string;
  llm_model: string;
  guardrails_triggered: boolean;
}

export interface DraftReply {
  draft_id: string;
  text: string;
  metrics: StreamMetrics;
}
