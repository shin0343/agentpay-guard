import { describe, expect, it } from "vitest";
import { PurchaseRequest } from "@/contract";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { harness } from "./backend-helpers";

const base = () =>
  structuredClone(SCENARIOS.find((s) => s.key === "a_low_risk")!.payload);

describe("security verification: semantic duplicate normalization", () => {
  it("blocks the same monetary amount despite leading-zero spelling", async () => {
    const h = await harness();
    const firstResponse = await h.call("purchase-requests", {
      method: "POST",
      role: "agent",
      body: base(),
    });
    expect(firstResponse.status).toBe(201);
    const first = PurchaseRequest.parse(await firstResponse.json());
    expect(first.status).toBe("ALLOWED");

    const padded = base();
    padded.amount.value = "018.00";
    const secondResponse = await h.call("purchase-requests", {
      method: "POST",
      role: "agent",
      body: padded,
    });
    expect(secondResponse.status).toBe(201);
    const second = PurchaseRequest.parse(await secondResponse.json());
    expect(second.duplicate_of).toBe(first.id);
    expect(
      second.evaluation!.policy.find((r) => r.rule_key === "duplicate_guard")!
        .outcome,
    ).toBe("block");
    expect(second.status).toBe("BLOCKED");
    expect(h.paypal.creates + h.paypal.captures).toBe(0);
  });

  it("blocks row-split equivalents even when an earlier request used a legacy fingerprint", async () => {
    const h = await harness();
    const grouped = base();
    grouped.items[0]!.quantity = 2;
    grouped.amount.value = "36.00";
    const split = structuredClone(grouped);
    split.items = [
      { ...split.items[0]!, quantity: 1 },
      { ...split.items[0]!, quantity: 1 },
    ];
    const first = PurchaseRequest.parse(
      await (
        await h.call("purchase-requests", {
          method: "POST",
          role: "agent",
          body: split,
        })
      ).json(),
    );
    await h.store.tx((state) => {
      state.requests[first.id]!.fingerprint =
        "legacy-row-sensitive-fingerprint";
    });
    const second = PurchaseRequest.parse(
      await (
        await h.call("purchase-requests", {
          method: "POST",
          role: "agent",
          body: grouped,
        })
      ).json(),
    );
    expect(second.status).toBe("BLOCKED");
    expect(second.duplicate_of).toBe(first.id);
    expect(
      second.evaluation!.policy.find(
        (rule) => rule.rule_key === "duplicate_guard",
      )!.outcome,
    ).toBe("block");
    expect(
      (
        await h.call(`purchase-requests/${second.id}/checkout`, {
          method: "POST",
          role: "operator",
          body: {},
        })
      ).status,
    ).toBe(409);
    expect(h.paypal.creates + h.paypal.captures).toBe(0);
  });
});
