/** Owner-only pairing messages; never include these in room snapshots. */
export interface PhotonPairingView { code?: string; expiresAt?: number; candidate?: string; paired: boolean; lastReply?: { messageId: string; acceptance: "accepted"; delivery: "unverified" } }
export interface PhotonStatus { configured: boolean; missing: string[]; invalid: string[]; apiVersion: string; deliveryVerified: boolean }
