export type ManagerAction = "reorder_supplies" | "simplify_menu";
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
}
export interface ManagerView {
  runtime: "local" | "deepagents";
  providerVerified: boolean;
  busy: boolean;
  summary: string;
  proposals: ManagerProposal[];
  trace: { tool: string; detail: string; at: number }[];
}
