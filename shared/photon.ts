/** Owner-only pairing messages; never include these in room snapshots. */
export interface PhotonPairingView { code?: string; expiresAt?: number; candidate?: string; paired: boolean; lastReply?: { messageId: string; acceptance: "accepted"; delivery: "unverified" } }
export interface PhotonStatus { transport: "bounded-inbox" | "webhook" | "disabled"; configured: boolean; missing: string[]; invalid: string[]; apiVersion: string; deliveryVerified: boolean }
