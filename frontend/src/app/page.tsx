"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Camera,
  Check,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  PhoneOff,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { api, getAuthToken, setAuthToken } from "@/lib/api";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useMeetingSocket } from "@/hooks/useMeetingSocket";
import { DashboardPanel } from "@/components/DashboardPanel";
import { PersonaManager } from "@/components/PersonaManager";
import { AvatarStage } from "@/components/AvatarStage";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { MeetingSummaryModal } from "@/components/MeetingSummaryModal";
import { MeetingHistory } from "@/components/MeetingHistory";
import { SummaryTemplates } from "@/components/SummaryTemplates";
import { CalendarScheduler } from "@/components/CalendarScheduler";
import {
  AuthUser,
  DashboardStats,
  MeetingHistoryItem,
  Persona,
  ScheduledMeeting,
  SessionSummary,
  SummaryTemplate,
} from "@/types/meeting";

type Tab =
  | "dashboard"
  | "meeting"
  | "calendar"
  | "templates"
  | "personas"
  | "history";

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [sessionsHistory, setSessionsHistory] = useState<MeetingHistoryItem[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [templates, setTemplates] = useState<SummaryTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("weekly_status");
  const [scheduled, setScheduled] = useState<ScheduledMeeting[]>([]);

  const [meetingTitle, setMeetingTitle] = useState("פגישת סטטוס שבועית");
  const [meetingAgenda, setMeetingAgenda] = useState(
    "עדכון התקדמות, סיכונים ומשימות לשבוע הקרוב"
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [summaryModal, setSummaryModal] = useState<SessionSummary | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [uploadingPersonaAvatar, setUploadingPersonaAvatar] = useState(false);
  const [draftEditText, setDraftEditText] = useState("");

  // Screen sharing + audio mute state
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const {
    videoRef,
    audioRef,
    connectionState,
    isMock,
    connect,
    disconnect,
    sendSimliAudio,
  } = useWebRTC();

  const {
    messages,
    botStatus,
    isReady,
    error: wsError,
    clearError: clearWsError,
    hitlMode,
    setHitlMode,
    pendingDraft,
    approveDraft,
    rejectDraft,
    sendGreet,
    lastMetrics,
    sendText,
    sendAudio,
  } = useMeetingSocket(activeSessionId, sendSimliAudio);

  useEffect(() => {
    if (pendingDraft) {
      setDraftEditText(pendingDraft.text);
    }
  }, [pendingDraft]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then((user) => {
        setAuthUser(user);
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthToken(null);
        router.replace("/login");
      });
  }, [router]);

  const loadAll = useCallback(async () => {
    const [pList, sList, st, tList, schList] = await Promise.all([
      api.listPersonas(),
      api.listSessions(),
      api.getStats(),
      api.listTemplates(),
      api.listSchedule(),
    ]);
    setPersonas(pList);
    setSelectedPersona((prev) => prev ?? pList[0] ?? null);
    setSessionsHistory(sList);
    setStats(st);
    setTemplates(tList);
    setScheduled(schList);
  }, []);

  useEffect(() => {
    if (!authChecked || !authUser) return;
    loadAll().catch((err) => setUiError(String(err)));
  }, [loadAll, authChecked, authUser]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
  }, []);

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play().catch(() => {});
      }
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      setIsScreenSharing(true);
    } catch (err) {
      setUiError(`שיתוף מסך בוטל או נכשל: ${String(err)}`);
    }
  };

  const captureScreenFrame = useCallback((): string | null => {
    const video = screenVideoRef.current;
    if (!isScreenSharing || !video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    const maxW = 960;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    return dataUrl.split(",")[1] || null;
  }, [isScreenSharing]);

  const handleSendText = useCallback(
    (text: string) => {
      const frame = captureScreenFrame();
      sendText(text, frame);
    },
    [captureScreenFrame, sendText]
  );

  const handleSendAudio = useCallback(
    (base64: string, mimeType: string) => {
      const frame = captureScreenFrame();
      sendAudio(base64, mimeType, frame);
    },
    [captureScreenFrame, sendAudio]
  );

  const handleStartMeeting = async (override?: {
    personaId?: string;
    title?: string;
    agenda?: string;
    templateId?: string;
  }) => {
    const pId = override?.personaId || selectedPersona?.id;
    if (!pId) {
      setUiError("יש לבחור או ליצור פרסונה לפני התחלת פגישה.");
      setTab("personas");
      return;
    }
    const chosenPersona = personas.find((p) => p.id === pId) || selectedPersona;
    if (chosenPersona) setSelectedPersona(chosenPersona);

    const finalTitle = override?.title ?? meetingTitle;
    const finalAgenda = override?.agenda ?? meetingAgenda;
    const finalTemplate = override?.templateId ?? selectedTemplateId;

    setMeetingTitle(finalTitle);
    setMeetingAgenda(finalAgenda);
    setSelectedTemplateId(finalTemplate);

    setUiError(null);
    setStarting(true);
    try {
      const initData = await api.createSession(
        pId,
        finalTitle,
        finalAgenda,
        finalTemplate
      );
      setActiveSessionId(initData.session_id);
      setTab("meeting");
      await connect(initData);
      loadAll().catch(() => {});
    } catch (err) {
      setUiError(`שגיאה בפתיחת פגישה: ${String(err)}`);
    } finally {
      setStarting(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!activeSessionId) return;
    setEnding(true);
    try {
      const summary = await api.endSession(activeSessionId);
      setSummaryModal(summary);
      disconnect();
      stopScreenShare();
      setActiveSessionId(null);
      await loadAll();
    } catch (err) {
      setUiError(`שגיאה בסיום פגישה: ${String(err)}`);
    } finally {
      setEnding(false);
    }
  };

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: "dashboard", label: "דשבורד וסטטיסטיקות", icon: LayoutDashboard },
    { id: "meeting", label: "חדר פגישה חי", icon: Video },
    { id: "calendar", label: "לוח שנה ותזמון", icon: CalendarDays, badge: scheduled.length },
    { id: "templates", label: "תבניות סיכום", icon: FileText, badge: templates.length },
    { id: "personas", label: "פרסונות ו-RAG", icon: Users, badge: personas.length },
    { id: "history", label: "היסטוריה וסיכומים", icon: History, badge: sessionsHistory.length },
  ];

  if (!authChecked || !authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-slate-950 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-sm">טוען את מסך ההתחברות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Right Sidebar Navigation (RTL) */}
      <aside className="lg:w-68 shrink-0 border-b lg:border-b-0 lg:border-l border-white/10 bg-slate-950/70 backdrop-blur-xl p-4 flex flex-col gap-5">
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-slate-950 shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">
              AuraMeet AI
            </h1>
            <p className="text-[11px] text-cyan-300/80">
              Simli WebRTC • Gemini AI
            </p>
          </div>
        </div>

        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-gradient-to-l from-cyan-500/20 to-indigo-500/20 text-white border border-cyan-400/40 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? "text-cyan-300" : ""}`} />
                  {item.label}
                </span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Signed-in User Profile Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={authUser.avatar_image_url}
              alt={authUser.full_name}
              className="w-9 h-9 rounded-full object-cover border border-cyan-400/50 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {authUser.full_name}
              </div>
              <div className="text-[11px] text-emerald-300/80 truncate">
                {authUser.email}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setAuthToken(null);
              setAuthUser(null);
              router.replace("/login");
            }}
            title="התנתק"
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Active Persona Mini-Card */}
        {selectedPersona && (
          <div className="hidden lg:block mt-auto rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400">פרסונה פעילה</div>
              <label
                title="החלף תמונת אווטאר מהמחשב"
                className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 cursor-pointer transition"
              >
                <Camera className="w-3 h-3" />
                {uploadingPersonaAvatar ? "מעלה..." : "החלף תמונה"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingPersonaAvatar}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !selectedPersona) return;
                    setUploadingPersonaAvatar(true);
                    setUiError(null);
                    try {
                      const updated = await api.uploadPersonaAvatar(
                        selectedPersona.id,
                        file
                      );
                      setSelectedPersona(updated);
                      setPersonas((prev) =>
                        prev.map((p) => (p.id === updated.id ? updated : p))
                      );
                    } catch (err) {
                      setUiError(`שגיאה בהעלאת תמונת פרסונה: ${String(err)}`);
                    } finally {
                      setUploadingPersonaAvatar(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2.5">
              <img
                src={selectedPersona.avatar_image_url}
                alt={selectedPersona.name}
                className="w-10 h-10 rounded-full object-cover border border-cyan-400/50 shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {selectedPersona.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {selectedPersona.voice_id}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1440px] mx-auto w-full">
        {/* Top Meeting Control Bar */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[170px]">
            <label className="block text-[11px] text-slate-400 mb-1">
              כותרת הפגישה
            </label>
            <input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              disabled={Boolean(activeSessionId)}
              className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex-[1.5] min-w-[200px]">
            <label className="block text-[11px] text-slate-400 mb-1">
              אג&apos;נדה והקשר
            </label>
            <input
              value={meetingAgenda}
              onChange={(e) => setMeetingAgenda(e.target.value)}
              disabled={Boolean(activeSessionId)}
              className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="min-w-[160px]">
            <label className="block text-[11px] text-slate-400 mb-1">
              תבנית סיכום
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={Boolean(activeSessionId)}
              className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {!activeSessionId ? (
            <button
              onClick={() => handleStartMeeting()}
              disabled={starting || !selectedPersona}
              className="inline-flex items-center gap-2 bg-gradient-to-l from-emerald-400 to-cyan-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-500/15 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              {starting ? "מתחבר לאווטאר..." : "התחל פגישה חיה"}
            </button>
          ) : (
            <button
              onClick={handleEndMeeting}
              disabled={ending}
              className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-rose-500/20 transition"
            >
              <PhoneOff className="w-4 h-4" />
              {ending ? "מפיק סיכום..." : "סיים והפק סיכום"}
            </button>
          )}
        </section>

        {(uiError || wsError) && (
          <div className="bg-rose-950/70 border border-rose-500/40 text-rose-200 px-4 py-3 rounded-2xl text-sm flex items-center justify-between">
            <span>{uiError || wsError}</span>
            <button
              onClick={() => {
                setUiError(null);
                clearWsError();
              }}
              className="text-xs underline text-rose-300 hover:text-white shrink-0 mr-3"
            >
              סגור
            </button>
          </div>
        )}

        {tab === "dashboard" && (
          <DashboardPanel
            stats={stats}
            recentSessions={sessionsHistory}
            scheduled={scheduled}
            onQuickStart={() => handleStartMeeting()}
            onGoToCalendar={() => setTab("calendar")}
          />
        )}

        {tab === "meeting" && (
          <div className="space-y-4">
            {activeSessionId && isReady && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={sendGreet}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-400/30 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    פתיחת פגישה אוטונומית
                  </button>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hitlMode}
                      onChange={(e) => setHitlMode(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                    מצב אישור אנושי (HITL)
                  </label>
                </div>

                {lastMetrics && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-white/10">
                      <Activity className="w-3 h-3 text-emerald-400" />
                      {lastMetrics.total_ms}ms (LLM {lastMetrics.llm_ms}ms • RAG {lastMetrics.rag_ms}ms)
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-white/10">
                      {lastMetrics.llm_provider} • {lastMetrics.tokens_used} tokens
                    </span>
                    {lastMetrics.guardrails_triggered && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/30">
                        Guardrails פעיל
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {pendingDraft && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-200">
                    מצב HITL — אשר או ערוך את תשובת הבוט לפני שהאווטאר מדבר:
                  </span>
                  <button
                    onClick={() => rejectDraft(pendingDraft.draft_id)}
                    className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
                  >
                    <X className="w-3.5 h-3.5" /> דחה
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={draftEditText}
                  onChange={(e) => setDraftEditText(e.target.value)}
                  className="w-full bg-slate-950/90 border border-amber-400/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-300"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => approveDraft(pendingDraft.draft_id, draftEditText)}
                    className="inline-flex items-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    אשר ושדר לאווטאר
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7">
                <AvatarStage
                  persona={selectedPersona}
                  videoRef={videoRef}
                  audioRef={audioRef}
                  screenVideoRef={screenVideoRef}
                  isScreenSharing={isScreenSharing}
                  onToggleScreenShare={toggleScreenShare}
                  onAskAboutScreen={() =>
                    handleSendText("תסתכל על המסך שאני משתף עכשיו ותסביר או תתייחס למה שמוצג.")
                  }
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted((m) => !m)}
                  connectionState={connectionState}
                  isMock={isMock}
                  botStatus={botStatus}
                  canInteract={Boolean(activeSessionId && isReady)}
                />
              </div>
              <div className="xl:col-span-5">
                <TranscriptPanel
                  messages={messages}
                  botStatus={botStatus}
                  disabled={!activeSessionId || !isReady}
                  isScreenSharing={isScreenSharing}
                  onSendText={handleSendText}
                  onSendAudio={handleSendAudio}
                />
              </div>
            </div>
          </div>
        )}

        {tab === "calendar" && (
          <CalendarScheduler
            scheduled={scheduled}
            personas={personas}
            templates={templates}
            onRefresh={loadAll}
            onLaunchMeeting={(m) =>
              handleStartMeeting({
                personaId: m.persona_id,
                title: m.title,
                agenda: m.agenda,
                templateId: m.template_id,
              })
            }
          />
        )}

        {tab === "templates" && (
          <SummaryTemplates
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onSelect={setSelectedTemplateId}
            onRefresh={loadAll}
          />
        )}

        {tab === "personas" && (
          <PersonaManager
            personas={personas}
            selectedId={selectedPersona?.id || null}
            userAvatarUrl={authUser.avatar_image_url}
            onSelect={setSelectedPersona}
            onRefresh={loadAll}
          />
        )}

        {tab === "history" && <MeetingHistory sessions={sessionsHistory} />}

        <MeetingSummaryModal
          summary={summaryModal}
          onClose={() => setSummaryModal(null)}
        />
      </main>
    </div>
  );
}
