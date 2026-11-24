"use client";

import { Calendar, CheckSquare } from "lucide-react";
import { MeetingHistoryItem } from "@/types/meeting";

interface Props {
  sessions: MeetingHistoryItem[];
}

export function MeetingHistory({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-8 text-center text-slate-400 text-sm">
        עדיין לא נערכו פגישות. התחל פגישה חדשה כדי לראות כאן תמלילים וסיכומים.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <div
          key={s.id}
          className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-white">{s.title}</h3>
              <p className="text-xs text-slate-400">
                סוכן: {s.persona_name || s.persona_id} •{" "}
                {new Date(s.created_at).toLocaleString("he-IL")}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-cyan-300 border border-white/10">
              {s.status} • {s.transcript.length} הודעות
            </span>
          </div>

          {s.summary && (
            <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3.5 text-sm text-slate-200">
              <div className="text-xs font-semibold text-cyan-400 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                תקציר
              </div>
              {s.summary}
            </div>
          )}

          {s.action_items && s.action_items.length > 0 && (
            <div className="text-sm text-slate-300 space-y-1">
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Action Items
              </div>
              <ul className="list-disc list-inside text-xs space-y-1">
                {s.action_items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
