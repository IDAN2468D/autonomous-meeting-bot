"use client";

import { useCallback, useRef, useState } from "react";
import { LogLevel, SimliClient } from "simli-client";
import { api } from "@/lib/api";
import { SessionInitResponse } from "@/types/meeting";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function useWebRTC() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const simliRef = useRef<SimliClient | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [isMock, setIsMock] = useState<boolean>(false);

  const disconnect = useCallback(() => {
    if (simliRef.current) {
      simliRef.current.stop().catch(() => {});
      simliRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setConnectionState("disconnected");
  }, []);

  const waitForMediaElements = async () => {
    for (let i = 0; i < 30; i++) {
      if (videoRef.current && audioRef.current) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  const connect = useCallback(
    async (sessionInit: SessionInitResponse) => {
      disconnect();
      setIsMock(sessionInit.mock);

      if (sessionInit.mock) {
        await api.sendSdpAnswer(sessionInit.session_id, {
          type: "answer",
          sdp: "v=0\r\nmock-answer",
        });
        setConnectionState("connected");
        return;
      }

      if (sessionInit.provider === "simli") {
        if (!sessionInit.simli_session_token) {
          throw new Error("Missing Simli session token");
        }
        setConnectionState("connecting");
        await waitForMediaElements();
        if (!videoRef.current || !audioRef.current) {
          throw new Error("Video/Audio elements not mounted");
        }

        const simli = new SimliClient(
          sessionInit.simli_session_token,
          videoRef.current,
          audioRef.current,
          null,
          LogLevel.INFO
        );
        simliRef.current = simli;

        await simli.start();
        setConnectionState("connected");
        return;
      }

      if (!sessionInit.offer) {
        throw new Error("Missing WebRTC offer");
      }

      setConnectionState("connecting");
      await waitForMediaElements();

      const pc = new RTCPeerConnection({
        iceServers: sessionInit.ice_servers,
      });
      pcRef.current = pc;

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await api.sendIceCandidate(sessionInit.session_id, {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid ?? undefined,
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined,
            });
          } catch (err) {
            console.error("Failed to send ICE candidate:", err);
          }
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
      };

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sessionInit.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await api.sendSdpAnswer(sessionInit.session_id, {
        type: answer.type,
        sdp: answer.sdp,
      });
    },
    [disconnect]
  );

  const sendSimliAudio = useCallback((base64Pcm16: string) => {
    const simli = simliRef.current;
    if (!simli) return;
    const pcmBytes = base64ToUint8Array(base64Pcm16);
    const chunkSize = 6000;
    for (let offset = 0; offset < pcmBytes.length; offset += chunkSize) {
      simli.sendAudioData(pcmBytes.subarray(offset, offset + chunkSize));
    }
  }, []);

  return {
    videoRef,
    audioRef,
    connectionState,
    isMock,
    connect,
    disconnect,
    sendSimliAudio,
  };
}
