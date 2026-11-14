/**
 * Real Photon Voice path — WebRTC audio between room members via WS signaling.
 * Falls back to Jamie AI call UI when alone; starts a live mic session when peers exist.
 */
import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { createVoiceSession, type VoiceSession } from "../lib/voice";
import { play } from "../lib/audio";

export function PhotonVoice({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const you = useApp((s) => s.you);
  const [status, setStatus] = useState("idle");
  const [remote, setRemote] = useState(false);
  const session = useRef<VoiceSession | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const peers = snapshot.players.filter((p) => p.id !== you);

  useEffect(() => {
    if (!conn || !you) return;
    const voice = createVoiceSession(conn, you, {
      onStatus: setStatus,
      onRemoteStream: (stream) => {
        setRemote(!!stream);
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          if (stream) void audioRef.current.play().catch(() => undefined);
        }
      },
    });
    session.current = voice;
    return () => voice.dispose();
  }, [conn, you]);

  if (!conn || !you) return null;

  return (
    <aside className="side-panel panel photon-voice">
      <p className="tag">Photon Voice</p>
      <h3>Live crew channel</h3>
      <p>
        {peers.length
          ? `${peers.length} peer${peers.length === 1 ? "" : "s"} in room — WebRTC over PlayFirst signaling.`
          : "Solo session — invite via QR, then start a live call. Jamie AI call still rings on rushes."}
      </p>
      <p className="voice-status" aria-live="polite">
        Status: <strong>{status}</strong>
        {remote ? " · remote audio" : ""}
      </p>
      <div className="voice-actions">
        <button
          type="button"
          className="btn"
          disabled={!peers.length || status === "calling" || status === "connected"}
          onClick={() => {
            play("ping", 0.35);
            void session.current?.startCall(peers[0]?.id).catch(() => setStatus("mic-blocked"));
          }}
        >
          Call {peers[0]?.name || "crew"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={status === "idle"}
          onClick={() => {
            session.current?.hangup();
            play("sad", 0.25);
          }}
        >
          Hang up
        </button>
      </div>
      <audio ref={audioRef} autoPlay playsInline />
    </aside>
  );
}
