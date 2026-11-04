/**
 * Adapter selection. `NEXT_PUBLIC_API_MODE=live` switches every screen to the real backend.
 * Live is the default. Offline demonstration requires an explicit `mock` build.
 */
import { createHttpAdapter } from "./http/http-adapter";
import { createMockAdapter } from "./mock/mock-adapter";
import type { ApiMode, GuardApi } from "./types";

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "mock" ? "mock" : "live";

let instance: GuardApi | null = null;

/** Browser-only singleton. Call from client components / effects. */
export function getApi(): GuardApi {
  if (!instance) instance = API_MODE === "live" ? createHttpAdapter() : createMockAdapter();
  return instance;
}

export * from "./types";
