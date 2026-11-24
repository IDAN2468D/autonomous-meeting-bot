"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/api";
import {
  BotStatus,
  DraftReply,
  StreamMetrics,
  TranscriptMessage,
} from "@/types/meeting";

export function useMeetingSocket(
  sessionId: string | null,
  onAudioPcm16?: (base64: string) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onAudioRef = useRef(onAudioPcm16);
  onAudioRef.current = onAudioPcm16;
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>("idle");
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hitlMode, setHitlModeState] = useState<boolean>(false);
  const [pendingDraft, setPendingDraft] = useState<DraftReply | null>(null);
  const [lastMetrics, setLastMetrics] = useState<StreamMetrics | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setIsReady(false);
      setPendingDraft(null);
      setLastMetrics(null);
      return;
    }

    setMessages([]);
    setError(null);
    setPendingDraft(null);
    setLastMetrics(null);
    const ws = new WebSocket(`${WS_URL}/ws/meeting/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "ready") {
        setIsReady(true);
        if (typeof data.hitl_mode === "boolean") {
          setHitlModeState(data.hitl_mode);
        }
      } else if (data.type === "mode_updated") {
        setHitlModeState(Boolean(data.hitl_mode));
      } else if (data.type === "status") {
        setBotStatus(data.status as BotStatus);
      } else if (data.type === "transcript") {
        setMessages((prev) => [
          ...prev,
          {
            speaker: data.speaker,
            text: data.text,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (data.type === "draft_reply") {
        setPendingDraft({
          draft_id: data.draft_id,
          text: data.text,
          metrics: data.metrics,
        });
        if (data.metrics) setLastMetrics(data.metrics as StreamMetrics);
      } else if (data.type === "metrics") {
        setLastMetrics(data as StreamMetrics);
      } else if (data.type === "audio_pcm16" && data.audio_base64) {
        onAudioRef.current?.(data.audio_base64);
      } else if (data.type === "error") {
        setError(data.message);
        setBotStatus("idle");
      }
    };

    ws.onclose = () => {
      setIsReady(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  const sendText = useCallback((text: string, screenImageBase64?: string | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: "text",
        text,
        ...(screenImageBase64 ? { screen_image_base64: screenImageBase64 } : {}),
      })
    );
  }, []);

  const sendAudio = useCallback(
    (audioBase64: string, mimeType: string, screenImageBase64?: string | null) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: "audio",
          audio_base64: audioBase64,
          mime_type: mimeType,
          ...(screenImageBase64
            ? { screen_image_base64: screenImageBase64 }
            : {}),
        })
      );
    },
    []
  );

  const setHitlMode = useCallback((enabled: boolean) => {
    setHitlModeState(enabled);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "set_mode", hitl: enabled }));
  }, []);

  const sendGreet = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "greet" }));
  }, []);

  const approveDraft = useCallback((draftId: string, text: string) => {
    setPendingDraft(null);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: "approve_draft", draft_id: draftId, text })
    );
  }, []);

  const rejectDraft = useCallback((draftId: string) => {
    setPendingDraft(null);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "reject_draft", draft_id: draftId }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    botStatus,
    isReady,
    error,
    clearError,
    hitlMode,
    setHitlMode,
    pendingDraft,
    approveDraft,
    rejectDraft,
    sendGreet,
    lastMetrics,
    sendText,
    sendAudio,
  };
}
