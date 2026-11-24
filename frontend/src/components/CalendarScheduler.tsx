"use client";

import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Persona,
  ScheduledMeeting,
  SummaryTemplate,
} from "@/types/meeting";

interface Props {
  scheduled: ScheduledMeeting[];
  personas: Persona[];
  templates: SummaryTemplate[];
  onRefresh: () => Promise<void>;
  onLaunchMeeting: (meeting: ScheduledMeeting) => void;
}

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function CalendarScheduler({
  scheduled,
  personas,
  templates,
  onRefresh,
  onLaunchMeeting,
}: Props) {
  const now = new Date();
  const defaultDateTime = new Date(now.getTime() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [title, setTitle] = useState("");
  const [personaId, setPersonaId] = useState(personas[0]?.id || "");
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [duration, setDuration] = useState(30);
  const [templateId, setTemplateId] = useState(templates[0]?.id || "weekly_status");
  const [agenda, setAgenda] = useState("");
  const [saving, setSaving] = useState(false);

  const calendarDays = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return { year, month, cells };
  }, []);

  const scheduledDaysSet = useMemo(() => {
    const set = new Set<number>();
    scheduled.forEach((m) => {
      const dt = new Date(m.scheduled_at);
      if (
        dt.getFullYear() === calendarDays.year &&
        dt.getMonth() === calendarDays.month
      ) {
        set.add(dt.getDate());
      }
    });
    return set;
  }, [scheduled, calendarDays]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenPersona = personaId || personas[0]?.id;
    if (!title.trim() || !chosenPersona) return;
    setSaving(true);
    try {
      await api.createSchedule({
        title: title.trim(),
        persona_id: chosenPersona,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        agenda: agenda.trim(),
        template_id: templateId,
      });
      setTitle("");
      setAgenda("");
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const monthTitle = now.toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Calendar + Schedule Form */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <CalendarIcon className="w-4 h-4 text-cyan-400" />
              {monthTitle}
            </h3>
            <span className="text-xs text-slate-400">
              {scheduled.length} פגישות מתוזמנות
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-slate-400 font-semibold py-1">
                {d}
              </div>
            ))}
            {calendarDays.cells.map((day, idx) => {
              const isToday = day === now.getDate();
              const hasEvent = day ? scheduledDaysSet.has(day) : false;
              return (
                <div
                  key={idx}
                  className={`h-9 rounded-xl flex flex-col items-center justify-center relative text-xs font-medium ${
                    !day
                      ? ""
                      : isToday
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : hasEvent
                      ? "bg-indigo-500/25 border border-indigo-400/40 text-indigo-100"
                      : "bg-slate-950/50 text-slate-300"
                  }`}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute bottom-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleSchedule}
          className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-5 space-y-3.5"
        >
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            תזמן פגישה חדשה
          </h3>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת הפגישה (לדוגמה: דמו ללקוח)"
            required
            className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">פרסונה</label>
              <select
                value={personaId || personas[0]?.id || ""}
                onChange={(e) => setPersonaId(e.target.value)}
                className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">תבנית סיכום</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">תאריך ושעה</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
                className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">משך (דקות)</label>
              <input
                type="number"
                min={5}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <textarea
            rows={2}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="אג'נדה והקשר לפגישה..."
            className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
          />

          <button
            type="submit"
            disabled={saving || personas.length === 0}
            className="w-full bg-gradient-to-l from-emerald-400 to-cyan-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition"
          >
            {saving ? "שומר בלוח השנה..." : "הוסף ללוח השנה"}
          </button>
        </form>
      </div>

      {/* Right: Scheduled Meetings List */}
      <div className="lg:col-span-7 space-y-4">
        <h3 className="font-bold text-white text-base">פגישות קרובות בלוח השנה</h3>

        {scheduled.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-10 text-center text-slate-400 text-sm">
            אין פגישות מתוזמנות כרגע. הוסף פגישה מהטופס כדי להפעיל אותה בלחיצת כפתור.
          </div>
        ) : (
          <div className="space-y-3">
            {scheduled.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-5 flex flex-wrap items-center justify-between gap-4 hover:border-cyan-400/30 transition"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">{m.title}</h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1 text-cyan-300">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(m.scheduled_at).toLocaleString("he-IL")} ({m.duration_minutes} דק׳)
                    </span>
                    <span>סוכן: {m.persona_name || m.persona_id}</span>
                  </div>
                  {m.agenda && (
                    <p className="text-xs text-slate-300 mt-1">{m.agenda}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLaunchMeeting(m)}
                    className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    התחל עכשיו
                  </button>
                  <button
                    onClick={async () => {
                      await api.deleteSchedule(m.id);
                      await onRefresh();
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    title="מחק מהיומן"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
