import {
  AuthResponse,
  AuthUser,
  DashboardStats,
  MeetingHistoryItem,
  Persona,
  PersonaCreatePayload,
  ScheduledMeeting,
  SessionInitResponse,
  SessionSummary,
  SummaryTemplate,
} from "@/types/meeting";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8088";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8088";
const TOKEN_KEY = "aurameet_jwt";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  listPersonas: () => request<Persona[]>("/api/v1/personas"),

  createPersona: (payload: PersonaCreatePayload) =>
    request<Persona>("/api/v1/personas", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deletePersona: (id: string) =>
    request<{ status: string }>(`/api/v1/personas/${id}`, { method: "DELETE" }),

  uploadKnowledge: (personaId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ filename: string; indexed_chunks: number }>(
      `/api/v1/personas/${personaId}/knowledge`,
      { method: "POST", body: formData }
    );
  },

  uploadPersonaAvatar: (personaId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<Persona>(`/api/v1/personas/${personaId}/avatar`, {
      method: "POST",
      body: formData,
    });
  },

  createSession: (
    persona_id: string,
    title: string,
    agenda: string,
    template_id: string = "weekly_status"
  ) =>
    request<SessionInitResponse>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ persona_id, title, agenda, template_id }),
    }),

  sendSdpAnswer: (sessionId: string, answer: RTCSessionDescriptionInit) =>
    request(`/api/v1/sessions/${sessionId}/sdp`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),

  sendIceCandidate: (sessionId: string, candidate: RTCIceCandidateInit) =>
    request(`/api/v1/sessions/${sessionId}/ice`, {
      method: "POST",
      body: JSON.stringify(candidate),
    }),

  endSession: (sessionId: string) =>
    request<SessionSummary>(`/api/v1/sessions/${sessionId}/end`, {
      method: "POST",
    }),

  listSessions: () => request<MeetingHistoryItem[]>("/api/v1/sessions"),

  getStats: () => request<DashboardStats>("/api/v1/stats"),

  listTemplates: () => request<SummaryTemplate[]>("/api/v1/templates"),

  createTemplate: (payload: {
    name: string;
    category: string;
    description: string;
    instructions: string;
  }) =>
    request<SummaryTemplate>("/api/v1/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteTemplate: (id: string) =>
    request<{ status: string }>(`/api/v1/templates/${id}`, {
      method: "DELETE",
    }),

  listSchedule: () => request<ScheduledMeeting[]>("/api/v1/schedule"),

  createSchedule: (payload: {
    title: string;
    persona_id: string;
    scheduled_at: string;
    duration_minutes: number;
    agenda: string;
    template_id: string;
  }) =>
    request<ScheduledMeeting>("/api/v1/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteSchedule: (id: string) =>
    request<{ status: string }>(`/api/v1/schedule/${id}`, {
      method: "DELETE",
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ avatar_image_url: string; filename: string }>(
      "/api/v1/auth/avatar/upload",
      { method: "POST", body: formData }
    );
  },

  register: (payload: {
    full_name: string;
    email: string;
    password: string;
    avatar_image_url?: string;
  }) =>
    request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request<AuthUser>("/api/v1/auth/me"),

  updateProfile: (payload: { full_name?: string; avatar_image_url?: string }) =>
    request<AuthUser>("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
