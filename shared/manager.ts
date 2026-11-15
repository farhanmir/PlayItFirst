export interface PickupMove {
  furnitureId: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
  start: { x: number; z: number };
  layoutSignature: string;
  beforeDistance: number;
  afterDistance: number;
  unit: "meters" | "simulation units";
  method: string;
}
export type ManagerAction = "reorder_supplies" | "simplify_menu" | "move_pickup";
export interface ManagerProposal {
  id: string;
  action: ManagerAction;
  reason: string;
  cost: number;
  requestedBy: string;
  expiresAt: number;
  status: "pending" | "approved" | "executed" | "declined" | "failed" | "expired";
  result?: string;
  transactionId?: string;
  actionReceiptId?: string;
  pickupMove?: PickupMove;
}
export interface ManagerProviderIdentity {
  provider: "google" | "openai" | "anthropic";
  model: string;
}
export interface ManagerView {
  runtime: "local" | "deepagents";
  providerVerified: boolean;
  /** Identity of the model used by this completed run, not merely configured credentials. */
  providerIdentity?: ManagerProviderIdentity;
  busy: boolean;
  summary: string;
  proposals: ManagerProposal[];
  trace: { tool: string; detail: string; at: number }[];
}
