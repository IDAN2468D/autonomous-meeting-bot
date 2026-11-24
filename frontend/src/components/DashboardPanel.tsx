"use client";

import {
  Activity,
  BarChart3,
  CalendarClock,
  CheckSquare,
  MessageSquare,
  Play,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import {
  DashboardStats,
  MeetingHistoryItem,
  ScheduledMeeting,
} from "@/types/meeting";

interface Props {
  stats: DashboardStats | null;
  recentSessions: MeetingHistoryItem[];
  scheduled: ScheduledMeeting[];
  onQuickStart: () => void;
  onGoToCalendar: () => void;
}

export function DashboardPanel({
  stats,
  recentSessions,
  scheduled,
  onQuickStart,
  onGoToCalendar,
}: Props) {
  const maxDayCount = Math.max(
    1,
    ...(stats?.daily_activity.map((d) => d.count) || [1])
  );

  const cards = [
    {
      label: "סה״כ פגישות",
      value: stats?.total_meetings ?? 0,
      sub: `${stats?.ended_meetings ?? 0} הסתיימו עם סיכום`,
      icon: Video,
      accent: "from-cyan-500/20 to-sky-500/5 border-cyan-400/25 text-cyan-300",
    },
    {
      label: "הודעות ותמלילים",
      value: stats?.total_messages ?? 0,
      sub: `ממוצע ${stats?.avg_messages_per_meeting ?? 0} לפגישה`,
      icon: MessageSquare,
      accent: "from-indigo-500/20 to-violet-500/5 border-indigo-400/25 text-indigo-300",
    },
    {
      label: "משימות שהופקו",
      value: stats?.total_action_items ?? 0,
      sub: "Action Items אוטומטיים",
      icon: CheckSquare,
      accent: "from-emerald-500/20 to-teal-500/5 border-emerald-400/25 text-emerald-300",
    },
    {
      label: "פגישות מתוזמנות",
      value: stats?.scheduled_meetings ?? 0,
      sub: `${stats?.total_personas ?? 0} פרסונות פעילות`,
      icon: CalendarClock,
      accent: "from-amber-500/20 to-orange-500/5 border-amber-400/25 text-amber-300",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-cyan-500/15 via-slate-900/90 to-indigo-600/15 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/15 border border-cyan-400/30 px-3 py-1 text-xs font-medium text-cyan-200">
              <Sparkles className="w-3.5 h-3.5" />
              Simli Live WebRTC + Gemini + Edge TTS
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              מרכז השליטה של סוכן הפגישות שלך
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              נהל פגישות וידאו חיות עם אווטאר מדבר, שתף מסך לניתוח בזמן אמת, בחר תבניות סיכום ותזמן פגישות ישירות מלוח השנה.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onQuickStart}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-400 to-emerald-400 hover:brightness-110 text-slate-950 font-bold px-5 py-3 text-sm shadow-lg shadow-cyan-500/20 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              התחל פגישה מיד
            </button>
            <button
              onClick={onGoToCalendar}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium px-5 py-3 text-sm transition"
            >
              <CalendarClock className="w-4 h-4 text-cyan-300" />
              תזמן פגישה
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-md ${c.accent}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300">
                  {c.label}
                </span>
                <div className="p-2 rounded-xl bg-slate-950/50 border border-white/10">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs text-slate-400 mt-1">{c.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Charts + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              פעילות פגישות ב-7 הימים האחרונים
            </h3>
            <span className="text-xs text-slate-400">פגישות ליום</span>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
            {(stats?.daily_activity || []).map((day) => {
              const heightPct = Math.max(8, Math.round((day.count / maxDayCount) * 100));
              const label = day.date.slice(5);
              return (
                <div key={day.date} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-bold text-cyan-300">
                    {day.count > 0 ? day.count : ""}
                  </span>
                  <div className="w-full bg-slate-950/80 rounded-xl h-32 flex items-end overflow-hidden border border-white/5 p-1">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        day.count > 0
                          ? "bg-gradient-to-t from-indigo-500 to-cyan-400"
                          : "bg-slate-800/60"
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5 space-y-4">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-indigo-400" />
            חלוקה לפי פרסונות
          </h3>

          {!stats || stats.persona_breakdown.length === 0 ? (
            <div className="text-xs text-slate-400 py-8 text-center">
              עדיין אין נתוני שימוש בפרסונות.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.persona_breakdown.map((item) => {
                const pct = Math.round(
                  (item.count / Math.max(1, stats.total_meetings)) * 100
                );
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-medium">{item.name}</span>
                      <span className="text-slate-400">
                        {item.count} פגישות ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                פגישות אחרונות / קרובות
              </span>
              <span>{scheduled.length} בלוח השנה</span>
            </div>
            <div className="space-y-2">
              {recentSessions.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2"
                >
                  <span className="text-slate-200 truncate max-w-[65%]">{s.title}</span>
                  <span className="text-slate-400">{s.transcript.length} הודעות</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
