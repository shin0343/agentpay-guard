import { z } from "zod";
import {
  CaptureCreate,
  Money,
  Merchant,
  PurchaseItem,
  PurchaseRequestCreate,
  ReviewCreate,
} from "@/contract";
import { cents, Fault } from "./util";
export const proposalSchema = PurchaseRequestCreate.extend({
  merchant: Merchant.strict(),
  items: z
    .array(PurchaseItem.extend({ unit_amount: Money.strict() }).strict())
    .min(1)
    .max(20),
  amount: Money.strict(),
  metadata: z
    .record(z.string().max(40), z.string().max(200))
    .refine((m) => Object.keys(m).length <= 10)
    .optional(),
}).strict();
export const reviewSchema = ReviewCreate.strict().refine(
  (v) => v.action !== "reject" || (v.note?.trim().length ?? 0) >= 3,
  {
    message: "Rejection needs a note of at least three characters.",
    path: ["note"],
  },
);
export const captureSchema = CaptureCreate.strict();
export const emptySchema = z.object({}).strict();
export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Fault("VALIDATION_FAILED", 422, "Input validation failed.", {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  return parsed.data;
}
export function proposal(input: unknown) {
  const raw = input as {
    amount?: { currency_code?: string };
    items?: { unit_amount?: { currency_code?: string } }[];
  };
  if (
    (raw?.amount?.currency_code && raw.amount.currency_code !== "USD") ||
    (Array.isArray(raw?.items) &&
      raw.items.some(
        (i) =>
          i?.unit_amount?.currency_code &&
          i.unit_amount.currency_code !== "USD",
      ))
  )
    throw new Fault("UNSUPPORTED_CURRENCY", 422, "Only USD is supported.");
  const r = validate(proposalSchema, input);
  const total = r.items.reduce(
    (n, i) => n + i.quantity * cents(i.unit_amount.value),
    0,
  );
  if (total <= 0 || total !== cents(r.amount.value))
    throw new Fault(
      "AMOUNT_MISMATCH",
      422,
      "Amount must equal the positive sum of item prices.",
    );
  return r;
}
