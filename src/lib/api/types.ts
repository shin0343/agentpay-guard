/**
 * The frontend integration boundary.
 *
 * Every screen talks to the backend ONLY through `GuardApi`. Two implementations exist:
 *   - `mock`  (src/lib/api/mock): in-browser simulation of the documented backend. No network, no PayPal, no AI.
 *   - `live`  (src/lib/api/http): fetches `/api/v1/*` exactly as specified in docs/API_CONTRACT.md.
 *
 * The backend owner implements the route handlers. The UI must not change when switching
 * `NEXT_PUBLIC_API_MODE` from `mock` to `live`.
 */
import type {
  ActivePolicy, AuditEventList, AuditEventType, ChainVerification, CheckoutConfig,
  ErrorCode, Payment, PurchaseRequest, PurchaseRequestList, RequestStatus,
  RequestWithPayment, ReviewCreate, ScenarioKey, ScenarioRun, Session,
} from "@/contract";

export type ApiMode = "mock" | "live";

export interface MutationOptions {
  /** Reuse the same key when retrying the same user intent. Adapters generate one when omitted. */
  idempotencyKey?: string;
}

export interface ListRequestsParams {
  status?: RequestStatus[];
  q?: string;
  agent_id?: string;
  updated_after?: string;
  limit?: number;
  cursor?: string;
}

export interface ListAuditParams {
  q?: string;
  purchase_request_id?: string;
  type?: AuditEventType[];
  state?: RequestStatus[];
  limit?: number;
  cursor?: string;
}

export interface GuardApi {
  readonly mode: ApiMode;

  // Session (§2.13)
  getSession(): Promise<Session | null>;
  signIn(passcode: string): Promise<Session>;
  signOut(): Promise<void>;

  // Purchase requests (§2.2–2.6)
  listPurchaseRequests(params?: ListRequestsParams): Promise<PurchaseRequestList>;
  getPurchaseRequest(id: string): Promise<PurchaseRequest>;
  submitReview(id: string, body: ReviewCreate, expectedVersion: number, opts?: MutationOptions): Promise<PurchaseRequest>;
  startCheckout(id: string, opts?: MutationOptions): Promise<RequestWithPayment>;
  cancelPurchaseRequest(id: string, opts?: MutationOptions): Promise<PurchaseRequest>;

  // Payments (§2.7–2.9)
  getPayment(id: string): Promise<Payment>;
  capturePayment(id: string, simulate: "none" | "instrument_declined", opts?: MutationOptions): Promise<RequestWithPayment>;
  reconcilePayment(id: string, opts?: MutationOptions): Promise<RequestWithPayment>;
  getCheckoutConfig(): Promise<CheckoutConfig>;

  // Ledger & policy (§2.10–2.12)
  listAuditEvents(params?: ListAuditParams): Promise<AuditEventList>;
  verifyAuditChain(): Promise<ChainVerification>;
  auditCsvUrl(params?: ListAuditParams): string | null;
  getActivePolicy(): Promise<ActivePolicy>;

  // Demo (§2.15) — DEMO_MODE only
  runScenario(key: ScenarioKey, opts?: MutationOptions): Promise<ScenarioRun>;
  resetDemo(): Promise<void>;

  /**
   * Push notifications for state changes. The mock adapter emits on every mutation;
   * the live adapter returns a no-op unsubscribe and the UI falls back to polling.
   */
  subscribe(listener: () => void): () => void;

  /** Mock only: simulates the PayPal payer approval window. `undefined` in live mode. */
  readonly mockPayer?: MockPayer;
}

export interface MockPayer {
  approve(paymentId: string): Promise<Payment>;
  close(paymentId: string): Promise<Payment>;
}

/** Normalized error for both adapters, mirroring the contract's error envelope. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly requestId: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
