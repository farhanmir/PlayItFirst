/**
 * Crew WebRTC telephony over SoftOpen room signaling (honestly not Photon 2.0).
 * Works peer-to-peer when a second player joins; Jamie call UI can also trigger a local loopback demo.
 */
import type { Conn } from "./net";
import type { ServerMsg } from "../../shared/types";

type SignalKind = "offer" | "answer" | "ice" | "hangup";

export interface VoiceSession {
  startCall(peerId?: string): Promise<void>;
  hangup(): void;
  dispose(): void;
  readonly active: boolean;
}

export function createVoiceSession(
  conn: Conn,
  you: string,
  opts: { onRemoteStream?: (stream: MediaStream | null) => void; onStatus?: (s: string) => void },
): VoiceSession {
  let pc: RTCPeerConnection | null = null;
  let local: MediaStream | null = null;
  let peerId: string | undefined;
  let active = false;

  const ensurePc = () => {
    if (pc) return pc;
    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      conn.send({
        t: "voice_signal",
        to: peerId,
        kind: "ice",
        candidate: JSON.stringify(ev.candidate),
      });
    };
    pc.ontrack = (ev) => {
      opts.onRemoteStream?.(ev.streams[0] ?? null);
    };
    pc.onconnectionstatechange = () => {
      opts.onStatus?.(pc?.connectionState || "closed");
      if (pc?.connectionState === "failed" || pc?.connectionState === "closed") {
        active = false;
      }
    };
    return pc;
  };

  const attachLocal = async () => {
    if (local) return local;
    local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const peer = ensurePc();
    for (const track of local.getTracks()) peer.addTrack(track, local);
    return local;
  };

  const handleSignal = async (m: Extract<ServerMsg, { t: "voice_signal" }>) => {
    if (m.from === you) return;
    if (m.kind === "hangup") {
      hangup();
      opts.onRemoteStream?.(null);
      return;
    }
    peerId = m.from;
    const peer = ensurePc();
    if (m.kind === "offer" && m.sdp) {
      await attachLocal();
      await peer.setRemoteDescription({ type: "offer", sdp: m.sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      conn.send({ t: "voice_signal", to: m.from, kind: "answer", sdp: answer.sdp });
      active = true;
      opts.onStatus?.("connected");
    } else if (m.kind === "answer" && m.sdp) {
      await peer.setRemoteDescription({ type: "answer", sdp: m.sdp });
      active = true;
      opts.onStatus?.("connected");
    } else if (m.kind === "ice" && m.candidate) {
      try {
        await peer.addIceCandidate(JSON.parse(m.candidate));
      } catch {
        /* stale candidate */
      }
    }
  };

  const unsub = (() => {
    const fn = (m: ServerMsg) => {
      if (m.t === "voice_signal") void handleSignal(m);
    };
    conn.onMessage(fn);
    return () => undefined;
  })();

  const hangup = () => {
    active = false;
    conn.send({ t: "voice_signal", to: peerId, kind: "hangup" });
    pc?.close();
    pc = null;
    local?.getTracks().forEach((t) => t.stop());
    local = null;
    opts.onRemoteStream?.(null);
    opts.onStatus?.("idle");
  };

  return {
    get active() {
      return active;
    },
    async startCall(to?: string) {
      peerId = to;
      opts.onStatus?.("calling");
      await attachLocal();
      const peer = ensurePc();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      conn.send({ t: "voice_signal", to, kind: "offer", sdp: offer.sdp });
      active = true;
    },
    hangup,
    dispose() {
      hangup();
      unsub();
    },
  };
}

export type { SignalKind };
