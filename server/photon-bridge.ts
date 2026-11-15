import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { CafeManager, ManagerActor } from "./manager.ts";
import type { ManagerView } from "../shared/manager.ts";
import { sendPhotonText, verifyPhotonEvent } from "./photon-transport.ts";

const id = (prefix: string) => z.string().regex(new RegExp(`^pho_${prefix}_[0-7][0-9a-hjkmnp-tv-z]{25}$`));
// Documented Photon Beta public event, API version 2026-07-01. Unknown fields
// are ignored, but every identity used for authorization is validated below.
const inbound = z.object({ id: id("evt"), apiVersion: z.literal("2026-07-01"), type: z.literal("message.received"),
  source: z.literal("imessage.photon"), timestamp: z.string().datetime(), data: z.object({ projectId: id("prj"),
    object: z.object({ id: id("msg"), projectId: id("prj"), platform: z.literal("imessage"), status: z.literal("received"),
      sentBy: z.object({ id: id("usr"), projectId: id("prj"), platform: z.literal("imessage"), handle: z.string().min(1).max(200) }),
      space: z.object({ id: id("spc"), projectId: id("prj"), platform: z.literal("imessage"), participantIds: z.array(id("usr")).length(2) }),
      content: z.object({ type: z.literal("text"), format: z.literal("plain"), text: z.string().min(1).max(1200) }),
    }) }) });
export interface PhotonConfig { projectId: string; senderId: string; apiKey: string; webhookSecret: string }
import type { PhotonPairingView } from "../shared/photon.ts";
export type { PhotonPairingView } from "../shared/photon.ts";
interface Pairing { actor: ManagerActor; code: string; expiresAt: number; candidate?: { senderId: string; spaceId: string; handle: string }; confirmed: boolean; lastReply?: PhotonPairingView["lastReply"] }
export class PhotonRequestError extends Error { constructor(public status: number, message: string) { super(message); } }

/** Ephemeral room pairing. Restart revokes every pairing and pending code. */
export class PhotonBridge {
  private pairs = new Map<string, Pairing>();
  private events = new Map<string, Promise<void>>();
  private lastRequest = new Map<string, number>();
  private busyRooms = new Set<string>();
  constructor(private config: PhotonConfig, private hooks: {
    authorize(actor: ManagerActor): void;
    manager(actor: ManagerActor): CafeManager;
    changed(actor: ManagerActor, view: PhotonPairingView): void;
    send?: typeof sendPhotonText;
    now?: () => number;
  }) {}
  private now() { return this.hooks.now?.() ?? Date.now(); }
  private view(p: Pairing): PhotonPairingView {
    return { paired: p.confirmed, ...(p.lastReply ? { lastReply: p.lastReply } : {}), ...(!p.confirmed ? { code: p.code, expiresAt: p.expiresAt } : {}),
      ...(p.candidate ? { candidate: `…${p.candidate.handle.slice(-4)}` } : {}) };
  }
  start(actor: ManagerActor) {
    this.hooks.authorize(actor);
    const p: Pairing = { actor: { ...actor }, code: randomBytes(6).toString("hex").toUpperCase(), expiresAt: this.now() + 300_000, confirmed: false };
    this.pairs.set(actor.roomCode, p); this.hooks.changed(actor, this.view(p)); return this.view(p);
  }
  confirm(actor: ManagerActor) {
    this.hooks.authorize(actor);
    const p = this.pairs.get(actor.roomCode);
    if (!p || p.actor.memberId !== actor.memberId || !p.candidate || p.expiresAt <= this.now()) throw new Error("No current phone pairing to confirm");
    // One sender/space belongs to one room; no accidental cross-room dispatch.
    for (const [room, other] of this.pairs) if (room !== actor.roomCode && other.candidate?.senderId === p.candidate.senderId && other.candidate.spaceId === p.candidate.spaceId) {
      this.pairs.delete(room); this.hooks.changed(other.actor, { paired: false });
    }
    p.confirmed = true; this.hooks.changed(actor, this.view(p)); return this.view(p);
  }
  forgetRoom(roomCode: string) { this.pairs.delete(roomCode); }
  revoke(actor: ManagerActor) { this.hooks.authorize(actor); this.pairs.delete(actor.roomCode); this.hooks.changed(actor, { paired: false }); }
  status(actor: ManagerActor) { this.hooks.authorize(actor); const p = this.pairs.get(actor.roomCode); return p && p.actor.memberId === actor.memberId ? this.view(p) : { paired: false }; }

  async receive(raw: string, headers: Record<string, string>) {
    let event: z.infer<typeof inbound>;
    try { event = inbound.parse(verifyPhotonEvent(raw, headers, this.config.webhookSecret)); }
    catch { throw new PhotonRequestError(400, "Invalid Photon signature or event schema"); }
    const message = event.data.object;
    const project = this.config.projectId;
    if (event.id !== headers["webhook-id"] || event.data.projectId !== project || message.projectId !== project || message.sentBy.projectId !== project || message.space.projectId !== project || message.sentBy.id === this.config.senderId || !message.space.participantIds.includes(this.config.senderId) || !message.space.participantIds.includes(message.sentBy.id)) throw new PhotonRequestError(400, "Photon identity mismatch");
    const previous = this.events.get(event.id);
    if (previous) return previous;
    // Never evict accepted event IDs during this process's room lifetime.
    if (this.events.size >= 1000) throw new PhotonRequestError(503, "Photon event capacity reached");
    const senderKey = message.sentBy.id;
    if (this.now() - (this.lastRequest.get(senderKey) ?? -Infinity) < 3000) {
      throw new PhotonRequestError(429, "Photon sender rate limit; retry after three seconds");
    }
    const paired = [...this.pairs.values()].find(p => p.confirmed && p.candidate?.senderId === message.sentBy.id && p.candidate.spaceId === message.space.id);
    if (paired && this.busyRooms.has(paired.actor.roomCode)) throw new PhotonRequestError(429, "Café manager busy; retry after three seconds");
    this.lastRequest.set(senderKey, this.now());
    const work = this.handle(event);
    this.events.set(event.id, work);
    return work;
  }
  private async handle(event: z.infer<typeof inbound>) {
    const m = event.data.object;
    const reply = async (text: string) => {
      const receipt = await (this.hooks.send ?? sendPhotonText)({ projectId: this.config.projectId, senderId: this.config.senderId,
        spaceId: m.space.id, text: text.slice(0, 4000), idempotencyKey: `pif-${event.id}` }, this.config.apiKey);
      const pairing = [...this.pairs.values()].find(p => p.candidate?.senderId === m.sentBy.id && p.candidate.spaceId === m.space.id);
      if (pairing) { pairing.lastReply = receipt; this.hooks.changed(pairing.actor, this.view(pairing)); }
      return receipt;
    };
    const text = m.content.text.trim();
    const pairing = /^PAIR ([A-F0-9]{12})$/i.exec(text);
    if (pairing) {
      const p = [...this.pairs.values()].find(p => !p.confirmed && p.code === pairing[1].toUpperCase() && p.expiresAt > this.now());
      if (!p || p.candidate) { await reply("Pairing code unavailable. Create a fresh code in the café owner menu."); return; }
      this.hooks.authorize(p.actor);
      p.candidate = { senderId: m.sentBy.id, spaceId: m.space.id, handle: m.sentBy.handle };
      this.hooks.changed(p.actor, this.view(p));
      await reply("Confirm this phone in the café owner menu. No café access is granted until confirmation."); return;
    }
    const p = [...this.pairs.values()].find(p => p.confirmed && p.candidate?.senderId === m.sentBy.id && p.candidate.spaceId === m.space.id);
    if (!p) { await reply("Pair this phone from the café owner menu first: PAIR followed by its code."); return; }
    this.hooks.authorize(p.actor);
    this.busyRooms.add(p.actor.roomCode);
    let replying = false;
    try {
      const manager = this.hooks.manager(p.actor);
      const approval = /^(APPROVE|DECLINE) ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(text);
      let view: ManagerView;
      if (approval) view = approval[1].toUpperCase() === "APPROVE" ? await manager.approve(p.actor, approval[2]) : manager.decline(p.actor, approval[2]);
      else if (/^(approve|yes|confirm|decline)\b/i.test(text)) { replying = true; await reply("Use APPROVE followed by the exact proposal ID, or DECLINE followed by that ID. A casual yes does not authorize a purchase."); return; }
      else view = await manager.request(p.actor, text);
      const pending = view.proposals.filter(q => q.status === "pending" && q.expiresAt > this.now());
      const instructions = pending.map(q => `\n${q.action}: $${q.cost}. Reply APPROVE ${q.id} or DECLINE ${q.id}.`).join("");
      replying = true;
      await reply(`${view.summary}${instructions}`);
    } catch (error) { if (replying) throw new PhotonRequestError(503, "Photon reply delivery is unknown; inspect provider receipt before retrying"); await reply("Request could not complete. Check the café's action receipts before retrying. No automatic retry was made."); }
    finally { this.busyRooms.delete(p.actor.roomCode); }
  }
}

export function photonConfigFromEnv(): PhotonConfig | null {
  const config = { projectId: process.env.PHOTON_PROJECT_ID?.trim(), senderId: process.env.PHOTON_SENDER_ID?.trim(),
    apiKey: process.env.PHOTON_API_KEY?.trim(), webhookSecret: process.env.PHOTON_WEBHOOK_SECRET?.trim() };
  if (!config.projectId || !config.senderId || !config.apiKey || !config.webhookSecret) return null;
  if (!id("prj").safeParse(config.projectId).success || !id("usr").safeParse(config.senderId).success || !config.apiKey.startsWith("pho_sk_") || !config.webhookSecret.startsWith("whsec_")) return null;
  return config as PhotonConfig;
}

/** Safe public readiness: names only, never credential values or fragments. */
export function photonConfigurationStatus() {
  const checks: Record<string, (value: string) => boolean> = {
    PHOTON_PROJECT_ID: value => id("prj").safeParse(value).success,
    PHOTON_SENDER_ID: value => id("usr").safeParse(value).success,
    PHOTON_API_KEY: value => value.startsWith("pho_sk_"),
    PHOTON_WEBHOOK_SECRET: value => value.startsWith("whsec_"),
  };
  const missing = Object.keys(checks).filter(key => !process.env[key]?.trim());
  const invalid = Object.entries(checks).filter(([key, validate]) => process.env[key]?.trim() && !validate(process.env[key]!.trim())).map(([key]) => key);
  return { configured: missing.length === 0 && invalid.length === 0, missing, invalid, apiVersion: "2026-07-01", deliveryVerified: false };
}
