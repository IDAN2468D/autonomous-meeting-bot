"use client";

import { RefObject } from "react";
import {
  Monitor,
  MonitorOff,
  Radio,
  ScanEye,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BotStatus, Persona } from "@/types/meeting";

interface Props {
  persona: Persona | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  screenVideoRef: RefObject<HTMLVideoElement | null>;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  onAskAboutScreen: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  connectionState: string;
  isMock: boolean;
  botStatus: BotStatus;
  canInteract: boolean;
}

const STATUS_LABELS: Record<BotStatus, string> = {
  idle: "ממתין לשאלה...",
  transcribing: "מתמלל אודיו...",
  thinking: "מעבד תשובה עם Gemini + RAG...",
  speaking: "מדבר בשידור חי...",
};

export function AvatarStage({
  persona,
  videoRef,
  audioRef,
  screenVideoRef,
  isScreenSharing,
  onToggleScreenShare,
  onAskAboutScreen,
  isMuted,
  onToggleMute,
  connectionState,
  isMock,
  botStatus,
  canInteract,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="relative bg-slate-950 border border-white/10 rounded-3xl overflow-hidden aspect-video flex items-center justify-center shadow-2xl shadow-black/50">
        {/* Shared Screen Main View */}
        <video
          ref={screenVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain bg-black ${
            isScreenSharing ? "block" : "hidden"
          }`}
        />

        {/* Avatar Video: Full stage normally, or Picture-in-Picture when screen sharing */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={
            isMock
              ? "hidden"
              : isScreenSharing
              ? "absolute bottom-16 left-4 w-44 md:w-56 aspect-video object-cover rounded-2xl border-2 border-cyan-400/70 shadow-2xl z-20 bg-slate-950"
              : "w-full h-full object-cover"
          }
        />
        <audio ref={audioRef} autoPlay muted={isMuted} className="hidden" />

        {isMock && persona && !isScreenSharing && (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
            <div
              className={`rounded-full p-1.5 transition-all duration-300 ${
                botStatus === "speaking"
                  ? "ring-4 ring-cyan-400 scale-105 shadow-[0_0_40px_rgba(34,211,238,0.45)]"
                  : "ring-2 ring-white/15"
              }`}
            >
              <img
                src={persona.avatar_image_url}
                alt={persona.name}
                className="w-40 h-40 rounded-full object-cover"
              />
            </div>
            <span className="mt-4 text-xs bg-amber-500/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full">
              Mock Mode פעיל (ללא צריכת קרדיטים)
            </span>
          </div>
        )}

        {!persona && !isScreenSharing && (
          <div className="text-slate-400 text-sm">בחר פרסונה והתחל פגישה</div>
        )}

        {/* Top Status Badges */}
        <div className="absolute top-3 right-3 left-3 flex items-center justify-between pointer-events-none z-20">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full backdrop-blur-md border ${
              connectionState === "connected"
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                : "bg-slate-900/80 border-white/15 text-slate-300"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {connectionState === "connected" ? "שידור חי מחובר" : connectionState}
          </span>

          {isScreenSharing && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/85 text-white border border-indigo-300/40 backdrop-blur-md">
              <Monitor className="w-3.5 h-3.5" />
              שיתוף מסך פעיל
            </span>
          )}
        </div>

        {/* Bottom Glass Bar */}
        <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between bg-slate-950/75 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 z-20">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                botStatus === "speaking"
                  ? "bg-cyan-400 animate-ping"
                  : connectionState === "connected"
                  ? "bg-emerald-400"
                  : "bg-slate-500"
              }`}
            />
            <span className="text-sm font-bold text-white">
              {persona?.name || "אווטאר"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{STATUS_LABELS[botStatus]}</span>
          </div>
        </div>
      </div>

      {/* Live Meeting Controls Dock */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              isScreenSharing
                ? "bg-rose-500/20 text-rose-300 border border-rose-400/40 hover:bg-rose-500/30"
                : "bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 hover:bg-indigo-500/30"
            }`}
          >
            {isScreenSharing ? (
              <>
                <MonitorOff className="w-4 h-4" />
                הפסק שיתוף מסך
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4" />
                שתף מסך בזמן אמת
              </>
            )}
          </button>

          {isScreenSharing && (
            <button
              type="button"
              disabled={!canInteract || botStatus !== "idle"}
              onClick={onAskAboutScreen}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 transition"
            >
              <ScanEye className="w-4 h-4" />
              נתח את המסך המשותף
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
            isMuted
              ? "bg-amber-500/20 border-amber-400/40 text-amber-200"
              : "bg-slate-800/80 border-white/10 text-slate-200 hover:bg-slate-700"
          }`}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4" />
              מושתק
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              שמע פעיל
            </>
          )}
        </button>
      </div>
    </div>
  );
}
