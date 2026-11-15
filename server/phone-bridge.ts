/** Opt-in hackathon phone session. Bounded polling of the documented Photon
 * Beta REST inbox, not a durable event consumer. No webhook is acknowledged or
 * replayed. A restart invalidates the session and requires a fresh pairing.
 * Voice transport is Photon SIP -> an externally provisioned voice agent.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { RoomSnapshot } from "../shared/types.ts";
import type { ManagerView } from "../shared/manager.ts";
import type { CafeManager, ManagerActor } from "./manager.ts";
import { photonMessagingTransport } from "./phone-policy.ts";
import { sendPhotonText } from "./photon-transport.ts";

export interface PhoneOwner {
  actor: ManagerActor;
  manager: Pick<CafeManager, "request" | "approve" | "decline" | "getView">;
  read(): RoomSnapshot;
  active(): boolean;
}
type Config = {
  apiKey: string; projectId: string; senderHandle: string; agentHandle: string;
  transport: "bounded-inbox" | "webhook" | "disabled";
  voiceSecret: string; voiceNumber: string; allowSponsor: boolean; activationCode: string;
};
type Incoming = { id: string; senderId: string; agentId: string; spaceId: string; text: string };
const id = (prefix: string, value: unknown): value is string => typeof value === "string" && new RegExp("^pho_" + prefix + "_[0-7][0-9a-hjkmnp-tv-z]{25}$").test(value);
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const secretEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export function phoneConfig(): Config {
  return {
    transport: photonMessagingTransport(),
    apiKey: process.env.PHOTON_API_KEY?.trim() || "",
    projectId: process.env.PHOTON_PROJECT_ID?.trim() || "",
    senderHandle: process.env.PHOTON_TEST_SENDER?.trim() || "",
    agentHandle: process.env.PHOTON_AGENT_HANDLE?.trim() || "",
    voiceSecret: process.env.PHOTON_VOICE_TOOL_SECRET?.trim() || "",
    voiceNumber: process.env.PHOTON_VOICE_NUMBER?.trim() || "",
    allowSponsor: process.env.ALLOW_SPONSOR_PHONE_CONTEXT === "true",
    activationCode: process.env.PHOTON_ACTIVATION_CODE?.trim() || "",
  };
}
// PHOTON_TEST_SENDER may list several teammates' iMessage handles, comma-separated. Pairing still binds one sender per session.
export const allowedSenders = (c: Config) => c.senderHandle.split(",").map((h) => h.trim()).filter(Boolean);
// Compare phone handles by digits so "+1 (703) 863-8400", "7038638400" and "+17038638400" all match; emails compare case-insensitively.
export const handleKey = (h: unknown) => {
  const v = String(h ?? "").trim();
  if (v.includes("@")) return v.toLowerCase();
  const d = v.replace(/\D/g, "");
  return d.length === 10 ? "1" + d : d;
};
const senderAllowed = (c: Config, handle: unknown) => !!handleKey(handle) && allowedSenders(c).some((h) => handleKey(h) === handleKey(handle));
const messagingConfigured = (c: Config) => c.transport === "bounded-inbox" && c.apiKey.startsWith("pho_sk_") && id("prj", c.projectId) && !!c.senderHandle && !!c.agentHandle;
const voiceConfigured = (c: Config) => c.voiceSecret.length >= 32 && /^\+[1-9]\d{7,14}$/.test(c.voiceNumber);
/** Why a polled message was ignored (no message content or phone numbers), for the live status line. */
export function rejectReason(raw: unknown, c: Config, since: number): string | null {
  const m = obj(raw), sender = obj(m.sentBy), space = obj(m.space), content = obj(m.content);
  const agent = obj(m.receivedBy ?? m.addressedTo);
  if (m.projectId !== c.projectId) return "project";
  if (m.platform !== "imessage") return "platform";
  if (m.status !== "received") return "status:" + String(m.status).slice(0, 20);
  if (typeof m.createdAt !== "string" || !Number.isFinite(Date.parse(m.createdAt)) || Date.parse(m.createdAt) < since) return "before-session";
  if (!id("msg", m.id)) return "message-id";
  // Photon marks its own lines kind "agent"; the human side's kind name is not documented, so only exclude agents.
  if (sender.kind === "agent") return "sender-is-agent";
  if (!senderAllowed(c, sender.handle)) return "sender-not-allowed";
  if (!id("usr", sender.id)) return "sender-id";
  if (Object.keys(agent).length) {
    if (handleKey(agent.handle) !== handleKey(c.agentHandle)) return "agent-handle";
    if (!id("usr", agent.id) || sender.id === agent.id) return "agent-id";
  } else if (!Array.isArray(space.participantIds) || !space.participantIds.some(p => p !== sender.id && id("usr", p))) return "no-agent";
  if (!id("spc", space.id)) return "space-id";
  if (space.kind !== "direct") return "space-kind:" + String(space.kind).slice(0, 20);
  if (content.type !== "text") return "content-type:" + String(content.type).slice(0, 20);
  if (typeof content.text !== "string" || !content.text.trim() || content.text.length > 1200) return "content-text";
  return null;
}
export function parseIncoming(raw: unknown, c: Config, since: number): Incoming | null {
  if (rejectReason(raw, c, since)) return null;
  const m = obj(raw), sender = obj(m.sentBy), space = obj(m.space), content = obj(m.content);
  const agent = obj(m.receivedBy ?? m.addressedTo);
  const agentId = typeof agent.id === "string" ? agent.id
    : (space.participantIds as unknown[]).find((p): p is string => p !== sender.id && id("usr", p))!;
  return { id: m.id as string, senderId: sender.id as string, agentId, spaceId: space.id as string, text: (content.text as string).trim() };
}
type Session = {
  owner: PhoneOwner; code: string; started: number; expires: number; propertyId: string | null;
  paired: Incoming | null; seen: Set<string>; messageState: string; lastIgnored?: string; voiceSeen: boolean;
  busy: boolean; nextVoiceAt: number; approvals: Map<string, { code: string; expires: number }>;
};
export class PhoneBridge {
  private session: Session | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private c = phoneConfig(), private fetcher: typeof fetch = fetch, private now = () => Date.now()) {}
  status() {
    return { transport: this.c.transport, messagingConfigured: messagingConfigured(this.c), voiceConfigured: voiceConfigured(this.c),
      messaging: this.session?.messageState || "not-started",
      ...(this.session?.lastIgnored ? { lastIgnored: this.session.lastIgnored } : {}),
      voice: this.session?.voiceSeen ? "tool-called-not-call-verified" : "not-verified" };
  }
  private live(s: Session) {
    const current = s.owner.read();
    const restricted = current.property?.source === "costar-extract" || current.property?.source === "costar-live";
    return this.session === s && this.now() < s.expires && s.owner.active() &&
      (current.property?.id ?? null) === s.propertyId && (!restricted || this.c.allowSponsor);
  }
  private belongs(s: Session, owner: PhoneOwner) {
    return s.owner.actor.roomCode === owner.actor.roomCode && s.owner.actor.memberId === owner.actor.memberId;
  }
  private get(owner: PhoneOwner) {
    const s = this.session;
    if (!s || !this.live(s) || !this.belongs(s, owner)) throw new Error("Start a fresh phone session in your café.");
    return s;
  }
  private info(s: Session) {
    return { ...this.status(), code: s.code, expiresAt: s.expires,
      paired: !!s.paired, agentHandle: messagingConfigured(this.c) ? this.c.agentHandle : null,
      voiceNumber: voiceConfigured(this.c) ? this.c.voiceNumber : null };
  }
  // No activation code: only the café owner can start a session, and only PHOTON_TEST_SENDER handles can pair to it.
  start(owner: PhoneOwner, _activationCode = "") {
    if (!owner.active()) throw new Error("Connect as the café owner first.");
    if (!messagingConfigured(this.c) && !voiceConfigured(this.c)) throw new Error("Phone provider configuration is incomplete.");
    const property = owner.read().property;
    if ((property?.source === "costar-extract" || property?.source === "costar-live") && !this.c.allowSponsor)
      throw new Error("External phone processing is not authorized for this property. Use a synthetic room.");
    if (this.session && this.live(this.session)) {
      if (!this.belongs(this.session, owner)) throw new Error("Another phone demo is active. End that session first.");
      return this.info(this.session);
    }
    this.stop();
    const now = this.now();
    const s: Session = { owner, code: randomBytes(8).toString("hex"), started: now, expires: now + 10 * 60_000,
      propertyId: property?.id ?? null, paired: null, seen: new Set(), messageState: messagingConfigured(this.c) ? "waiting-for-pair" : "not-configured",
      voiceSeen: false, busy: false, nextVoiceAt: 0, approvals: new Map() };
    this.session = s;
    if (messagingConfigured(this.c)) this.schedule(s, 0);
    return this.info(s);
  }
  getStatus(owner: PhoneOwner) { return this.info(this.get(owner)); }
  end(owner: PhoneOwner) { this.get(owner); this.stop(); return { ended: true }; }
  private stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined; this.session = null;
  }
  private schedule(s: Session, delay: number) {
    if (!this.live(s)) { if (this.session === s) this.stop(); return; }
    this.timer = setTimeout(() => void this.poll(s), delay);
    this.timer.unref?.();
  }
  /** Process only messages created after the explicit pairing session begins.
   * Never poll across restarts, or replay an ambiguous send/mutation. */
  private async poll(s: Session) {
    if (!this.live(s)) { if (this.session === s) this.stop(); return; }
    try {
      let pageToken: string | undefined;
      for (let page = 0; page < 3; page++) {
        if (!this.live(s)) return;
        const query = new URLSearchParams({ createdSince: new Date(s.started - 5000).toISOString(), direction: "received",
          order: "asc", pageSize: "100", platform: "imessage" });
        if (pageToken) query.set("pageToken", pageToken);
        const r = await this.fetcher("https://api.photon.codes/v1/projects/" + this.c.projectId + "/messages?" + query.toString(), {
          headers: { Authorization: "Bearer " + this.c.apiKey }, redirect: "error", signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw new Error("Inbox HTTP " + r.status);
        const data = obj(await r.json());
        if (!Array.isArray(data.items)) throw new Error("Unexpected inbox response");
        for (const raw of data.items) {
          if (!this.live(s)) return;
          const why = rejectReason(raw, this.c, s.started);
          if (why && why !== "before-session") s.lastIgnored = why;
          const m = why ? null : parseIncoming(raw, this.c, s.started);
          if (!m || s.seen.has(m.id)) continue;
          // Mark before work. Unknown delivery/execution is never automatically replayed.
          if (s.seen.size >= 100) throw new Error("Session message limit");
          s.seen.add(m.id);
          await this.handleMessage(s, m);
        }
        pageToken = typeof data.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : undefined;
        if (!pageToken) break;
        if (page === 2) throw new Error("Session inbox capacity");
      }
      this.schedule(s, 3000);
    } catch {
      if (this.session === s) {
        // Stop on provider failure or rate limit. A new session requires owner action.
        s.messageState = "paused-error-restart-session";
      }
    }
  }
  private async reply(s: Session, m: Incoming, text: string) {
    if (!this.live(s)) return;
    await sendPhotonText({ projectId: this.c.projectId, senderId: m.agentId, spaceId: m.spaceId,
      text: text.slice(0, 3900), idempotencyKey: "playitfirst:" + m.id }, this.c.apiKey, this.fetcher);
    s.messageState = "reply-accepted-delivery-unverified";
  }
  private async handleMessage(s: Session, m: Incoming) {
    if (!s.paired) {
      if (!secretEqual(m.text.toLowerCase(), "pair " + s.code)) return;
      s.paired = m;
      await this.reply(s, m, "Jamie connected to your café for this demo session. Ask about stock, cash or queues. Approve only with the exact APPROVE proposal ID shown in a reply. Send STOP to disconnect.");
      return;
    }
    if (m.senderId !== s.paired.senderId || m.agentId !== s.paired.agentId || m.spaceId !== s.paired.spaceId) return;
    if (/^stop$/i.test(m.text)) {
      await this.reply(s, m, "Phone session disconnected. Start another in the game to reconnect.");
      if (this.session === s) this.stop(); return;
    }
    if (/^pair /i.test(m.text)) return;
    if (s.busy) { await this.reply(s, m, "Jamie is busy. Send a new message when the current operation finishes."); return; }
    s.busy = true;
    let result: string;
    try {
      const command = /^(approve|decline) ([0-9a-f-]{36})$/i.exec(m.text);
      if (command) {
        const proposal = s.owner.manager.getView().proposals.find(p => p.id === command[2].toLowerCase() && p.requestedBy === s.owner.actor.memberId);
        if (!proposal) throw new Error("Proposal not found");
        const view = command[1].toLowerCase() === "approve" ? await s.owner.manager.approve(s.owner.actor, proposal.id) : s.owner.manager.decline(s.owner.actor, proposal.id);
        result = this.describe(s, view);
      } else {
        const view = await s.owner.manager.request(s.owner.actor, m.text);
        result = this.describe(s, view);
      }
    } catch { result = "The request was refused or is busy. Check the game for receipts and ask again if needed. No success is assumed."; }
    finally { s.busy = false; }
    await this.reply(s, m, result);
  }
  private describe(s: Session, view: ManagerView) {
    const current = s.owner.read();
    const proposals = view.proposals.slice(-3).map(p => p.status === "pending"
      ? p.action + " — $" + p.cost.toFixed(2) + ". APPROVE " + p.id
      : p.action + " — " + p.status + (p.result ? ": " + p.result : "") + (p.transactionId ? " (game receipt " + p.transactionId + ")" : ""));
    return [view.summary.slice(0, 1600), "Actual game cash $" + current.finance.balance.toFixed(2) +
      "; milk " + current.inventory.milk + ", cups " + current.inventory.cups + ", beans " + current.inventory.beans + ".", ...proposals].join("\n");
  }
  issueVoiceApproval(owner: PhoneOwner, proposalId: string) {
    const s = this.get(owner);
    if (!voiceConfigured(this.c)) throw new Error("Voice is not configured.");
    const p = s.owner.manager.getView().proposals.find(p => p.id === proposalId && p.requestedBy === owner.actor.memberId && p.status === "pending");
    if (!p || p.expiresAt <= this.now()) throw new Error("Select a current pending proposal.");
    const code = randomBytes(4).toString("hex");
    s.approvals.set(p.id, { code, expires: Math.min(p.expiresAt, this.now() + 90_000) });
    return { approvalCode: code, proposalId: p.id, cost: p.cost };
  }
  async voice(auth: string, body: Record<string, unknown>) {
    if (!voiceConfigured(this.c) || !secretEqual(auth, "Bearer " + this.c.voiceSecret)) throw new Error("Unauthorized voice tool.");
    const s = this.session;
    if (!s || !this.live(s) || typeof body.code !== "string" || !secretEqual(body.code.toLowerCase(), s.code)) throw new Error("Valid owner phone session code required.");
    if (s.busy || this.now() < s.nextVoiceAt) throw new Error("Jamie is busy; try again after this operation.");
    s.nextVoiceAt = this.now() + 2500;
    s.busy = true;
    try {
      let view = s.owner.manager.getView();
      if (body.action === "ask") {
        if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 1200) throw new Error("A question is required.");
        view = await s.owner.manager.request(s.owner.actor, body.question);
      } else if (body.action === "approve") {
        if (typeof body.proposalId !== "string" || typeof body.approvalCode !== "string") throw new Error("Exact proposal ID and owner-issued approval code required.");
        const approval = s.approvals.get(body.proposalId);
        if (!approval || approval.expires <= this.now() || !secretEqual(body.approvalCode.toLowerCase(), approval.code)) throw new Error("Invalid or expired owner approval code.");
        s.approvals.delete(body.proposalId);
        view = await s.owner.manager.approve(s.owner.actor, body.proposalId);
      } else if (body.action !== "status") throw new Error("Unsupported voice action.");
      if (!this.live(s)) throw new Error("Phone session ended.");
      s.voiceSeen = true;
      return { answer: this.describe(s, view), proposals: view.proposals.slice(-3).map(p => ({ id:p.id, action:p.action, costUSD:p.cost, status:p.status, result:p.result, transactionId:p.transactionId })), callVerified: false };
    } finally { s.busy = false; }
  }
}
