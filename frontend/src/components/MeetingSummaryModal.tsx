"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, X } from "lucide-react";
import { SessionSummary } from "@/types/meeting";

interface Props {
  summary: SessionSummary | null;
  onClose: () => void;
}

export function MeetingSummaryModal({ summary, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!summary) return null;

  const handleCopy = async () => {
    const text = [
      `סיכום פגישה${summary.template_name ? ` (${summary.template_name})` : ""}:`,
      summary.summary,
      "",
      "משימות להמשך:",
      ...summary.action_items.map((item) => `- ${item}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              סיכום פגישה אוטומטי
            </h3>
            {summary.template_name && (
              <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                תבנית: {summary.template_name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed">
          {summary.summary}
        </div>

        {summary.action_items.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-cyan-400">
              משימות להמשך (Action Items)
            </h4>
            <ul className="space-y-1.5 text-sm text-slate-200 list-disc list-inside">
              {summary.action_items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-sm transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "הועתק!" : "העתק סיכום"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-l from-cyan-400 to-emerald-400 hover:brightness-110 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
