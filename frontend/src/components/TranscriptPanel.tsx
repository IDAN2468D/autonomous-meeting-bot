"use client";

import { useState } from "react";
import { Mic, MicOff, Monitor, Send } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { BotStatus, TranscriptMessage } from "@/types/meeting";

interface Props {
  messages: TranscriptMessage[];
  botStatus: BotStatus;
  disabled: boolean;
  isScreenSharing: boolean;
  onSendText: (text: string) => void;
  onSendAudio: (base64: string, mimeType: string) => void;
}

const QUICK_PROMPTS = [
  "תציג את עצמך בקצרה",
  "מה הנקודות החשובות באג'נדה?",
  "סכם את מה שדיברנו עד עכשיו",
];

export function TranscriptPanel({
  messages,
  botStatus,
  disabled,
  isScreenSharing,
  onSendText,
  onSendAudio,
}: Props) {
  const [input, setInput] = useState("");
  const { isRecording, startRecording, stopRecording } =
    useAudioRecorder(onSendAudio);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendText(input.trim());
    setInput("");
  };

  return (
    <div className="bg-slate-900/70 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col h-[540px] shadow-xl">
      <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
        <span className="font-bold text-sm text-white">תמליל פגישה חי</span>
        {isScreenSharing && (
          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/15 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
            <Monitor className="w-3 h-3" />
            כולל הקשר מסך
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-8 space-y-4">
            <p className="text-slate-400 text-sm">
              לחץ על המיקרופון או כתוב הודעה כדי לדבר עם האווטאר.
            </p>
            {!disabled && (
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSendText(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-100 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, idx) => {
          const isAvatar = m.speaker === "avatar";
          return (
            <div
              key={idx}
              className={`flex ${isAvatar ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isAvatar
                    ? "bg-gradient-to-l from-cyan-500/20 to-indigo-500/15 border border-cyan-400/30 text-cyan-50"
                    : "bg-slate-800/90 border border-white/10 text-slate-100"
                }`}
              >
                <div className="text-[11px] font-semibold opacity-70 mb-1">
                  {isAvatar ? "סוכן AI" : "משתתף"}
                </div>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 flex items-center gap-2"
      >
        <button
          type="button"
          disabled={disabled || botStatus !== "idle"}
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-3 rounded-xl transition ${
            isRecording
              ? "bg-rose-500 hover:bg-rose-400 text-white animate-pulse"
              : "bg-slate-800 hover:bg-slate-700 text-cyan-300 disabled:opacity-40"
          }`}
          title={isRecording ? "עצור ושלח הקלטה" : "הקלט דיבור"}
        >
          {isRecording ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || botStatus !== "idle"}
          placeholder={
            isScreenSharing
              ? "שאל את הבוט על המסך המשותף..."
              : "כתוב שאלה לסוכן בפגישה..."
          }
          className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 disabled:opacity-40"
        />

        <button
          type="submit"
          disabled={disabled || !input.trim() || botStatus !== "idle"}
          className="p-3 bg-gradient-to-l from-cyan-400 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-slate-950 rounded-xl transition"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
