/**
 * Adapter selection. `NEXT_PUBLIC_API_MODE=live` switches every screen to the real backend.
 * Default is `mock` so the frontend runs standalone.
 */
import { createHttpAdapter } from "./http/http-adapter";
import { createMockAdapter } from "./mock/mock-adapter";
import type { ApiMode, GuardApi } from "./types";

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

let instance: GuardApi | null = null;

/** Browser-only singleton. Call from client components / effects. */
export function getApi(): GuardApi {
  if (!instance) instance = API_MODE === "live" ? createHttpAdapter() : createMockAdapter();
  return instance;
}

export * from "./types";
