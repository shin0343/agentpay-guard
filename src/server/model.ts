import type {
  AuditEvent,
  MerchantCategory,
  Payment,
  PurchaseRequest,
  Session,
} from "@/contract";
export type Principal =
  | { kind: "agent"; id: string; name: string }
  | { kind: "operator" | "reviewer"; id: string; name: string };
export type Agent = {
  id: string;
  name: string;
  owner_user_id: string;
  allowed_categories: MerchantCategory[];
  key_hash: string;
};
export type StoredRequest = PurchaseRequest & {
  trusted_catalog: boolean;
  retry_extended?: boolean;
};
export type StoredPayment = Payment & {
  create_claim_until?: number;
  capture_claim_until?: number;
};
export type Idem = {
  id: string;
  hash: string;
  state: "processing" | "done";
  expires: number;
  lease: number;
  status?: number;
  body?: unknown;
};
export type StoreState = {
  requests: Record<string, StoredRequest>;
  payments: Record<string, StoredPayment>;
  agents: Record<string, Agent>;
  idempotency: Record<string, Idem>;
  webhooks: Record<string, { id: string }>;
  limits: Record<string, { id: string; count: number; until: number }>;
  events: AuditEvent[];
};
export const emptyState = (): StoreState => ({
  requests: {},
  payments: {},
  agents: {},
  idempotency: {},
  webhooks: {},
  limits: {},
  events: [],
});
export interface Store {
  tx<T>(fn: (s: StoreState) => T | Promise<T>): Promise<T>;
}
export type User = Session["user"];
