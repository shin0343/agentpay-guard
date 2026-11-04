/**
 * Real-backend UI verification + explicitly intercepted payment/SDK boundary tests.
 * Requires a live build, a disposable migrated DB and DEMO_MODE=true.
 * BASE=http://127.0.0.1:3100 QA_PASSCODE=<reviewer> NODE_PATH=<scratch Playwright node_modules>
 *   node scripts/frontend-qa.cjs qa/frontend-live
 * No provider credentials are used; intercepted states are never payment evidence.
 */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BASE = process.env.BASE || "http://127.0.0.1:3100";
const OUT = process.argv[2] || "qa/frontend-live";
const passcode = process.env.QA_PASSCODE;
if (!passcode) throw new Error("QA_PASSCODE is required for the disposable QA environment.");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function shot(page, name) {
  if (/fixture|responsive|dark-reduced/.test(name)) await page.evaluate(() => {
    if (document.getElementById("qa-evidence-label")) return;
    const label = document.createElement("p");
    label.id = "qa-evidence-label";
    label.textContent = "QA boundary fixture · PayPal responses intercepted · no genuine payment";
    label.style.cssText = "padding:8px 16px;border-bottom:1px solid var(--rule);background:var(--sunken);color:var(--ink);font:13px sans-serif";
    document.body.prepend(label);
  });
  if (/live-ledger/.test(name)) await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const width = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(width[0] <= width[1] + 1, `${name}: horizontal overflow ${width}`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !/live-ledger/.test(name) });
  console.log("shot", name);
}
async function post(page, route, body = {}, key = crypto.randomUUID()) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === "apg_csrf")?.value;
  return page.request.post(`${BASE}/api/v1/${route}`, { data: body, headers: { "X-CSRF-Token": csrf || "", "Idempotency-Key": key } });
}
async function scenario(page, title) {
  await page.getByRole("button", { name: "Send test request", exact: true }).first().click();
  await page.getByText(title, { exact: true }).click();
  const sent = page.waitForResponse((response) => /\/demo\/scenarios\/[^/]+\/run$/.test(new URL(response.url()).pathname) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send as agent", exact: true }).click();
  const result = await (await sent).json();
  await page.waitForURL((url) => url.pathname === `/requests/${result.purchase_request.id}`);
  return result.purchase_request.id;
}
async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Passcode", { exact: true }).fill(passcode);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/requests$/);
}
async function json(route, data, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data), headers: { "X-Request-Id": "req_browser_fixture" } });
}
(async () => {
  const browser = await chromium.launch();
  let sample;
  for (const mode of ["desktop", "mobile"]) {
    const context = await browser.newContext({ viewport: mode === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 }, isMobile: mode === "mobile", hasTouch: mode === "mobile", colorScheme: "light" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await login(page);
    assert.ok((await post(page, "demo/reset")).ok());
    await page.reload();
    await page.getByText("No agent requests yet.", { exact: true }).first().waitFor();
    await shot(page, `${mode}-live-empty`);
    const a = await scenario(page, "Low risk");
    await page.getByText("Allowed.", { exact: true }).waitFor();
    await page.getByText("Simulated AI assessment", { exact: true }).waitFor();
    await page.getByText("Not paid. Payer approval is next.", { exact: true }).waitFor();
    await shot(page, `${mode}-live-allowed`);
    sample = await (await page.request.get(`${BASE}/api/v1/purchase-requests/${a}`)).json();
    const b = await scenario(page, "Needs a human");
    await page.getByRole("link", { name: "Open review", exact: true }).click();
    await page.getByRole("heading", { name: "Why this needs you", exact: true }).waitFor();
    await shot(page, `${mode}-live-review`);
    if (mode === "desktop") {
      await page.keyboard.press("a");
      await page.getByRole("dialog", { name: "Grant policy approval?" }).waitFor();
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: /Approve purchase/ }).click();
    await page.getByText("Allowed.", { exact: true }).waitFor();
    await delay(1700);
    assert.ok(page.url().includes(`/review/${b}`), "review confirmation must not auto-navigate");
    await shot(page, `${mode}-live-policy-approved`);
    const c = await scenario(page, "High risk");
    await page.getByText("Blocked.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Continue to PayPal", exact: true }).count(), 0);
    await shot(page, `${mode}-live-blocked`);
    const events = await (await page.request.get(`${BASE}/api/v1/audit-events?purchase_request_id=${c}&limit=100`)).json();
    assert.equal(events.data.filter((event) => /^(checkout|payment|payer)\./.test(event.type)).length, 0);
    await scenario(page, "Network retry");
    await page.getByText("Retry replayed. No new request was created.", { exact: true }).waitFor();
    await scenario(page, "Duplicate purchase");
    await page.getByText("Blocked.", { exact: true }).waitFor();
    await shot(page, `${mode}-live-duplicate`);
    // A real review rejection and cancellation, persisted through real routes.
    const reviewProposal = await (await post(page, "demo/scenarios/b_needs_review/run")).json();
    // Existing B can cause a duplicate; reset only unpaid/no-payment proposals first.
    if (reviewProposal.purchase_request.status !== "IN_REVIEW") {
      assert.ok((await post(page, "demo/reset")).ok());
    }
    const fresh = await (await post(page, "demo/scenarios/b_needs_review/run")).json();
    if (fresh.purchase_request.status === "IN_REVIEW") {
      await page.goto(`${BASE}/review/${fresh.purchase_request.id}`);
      await page.getByRole("button", { name: /^Reject/ }).click();
      await page.getByRole("dialog").getByLabel("Note · required", { exact: true }).fill("Outside this sprint budget.");
      await page.getByRole("button", { name: "Reject purchase", exact: true }).click();
      await page.getByText("Rejected.", { exact: true }).waitFor();
      await shot(page, `${mode}-live-rejected`);
    }
    const cancelProposal = await (await post(page, "demo/scenarios/e_capture_declined/run")).json();
    await page.goto(`${BASE}/requests/${cancelProposal.purchase_request.id}`);
    await page.getByRole("button", { name: "Cancel request", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel request", exact: true }).click();
    await page.getByText("Cancelled.", { exact: true }).waitFor();
    await shot(page, `${mode}-live-cancelled`);
    await page.reload();
    await page.getByText("Cancelled.", { exact: true }).waitFor();
    await page.goto(`${BASE}/ledger`);
    await page.locator("tbody tr").first().waitFor();
    await page.getByText(/Chain verified/).waitFor();
    const earlier = page.getByRole("button", { name: "Load earlier events", exact: true });
    if (await earlier.count()) {
      const count = await page.locator("tbody > tr").count();
      await earlier.click();
      await page.waitForFunction((count) => document.querySelectorAll("tbody > tr").length > count, count);
    }
    await shot(page, `${mode}-live-ledger`);
    await page.locator("tbody button[aria-expanded]").first().click();
    await shot(page, `${mode}-live-ledger-expanded`);
    await page.getByRole("combobox", { name: "Event type" }).selectOption("review.rejected");
    await page.getByText("review.rejected", { exact: true }).first().waitFor({ state: mode === "desktop" ? "visible" : "attached" });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    await (await download).saveAs(path.join(OUT, `${mode}-live-filtered.csv`));
    await page.goto(`${BASE}/policies`);
    await page.getByRole("heading", { name: "Policies", exact: true }).waitFor();
    await shot(page, `${mode}-live-policies`);
    await page.goto(`${BASE}/requests/preq_not_found`);
    await page.getByText("Nothing here.", { exact: true }).waitFor();
    // Expected missing-resource HTTP response can emit a browser network console error.
    const unexpected = errors.filter((error) => !/Failed to load resource: the server responded with a status of 404/.test(error));
    assert.deepEqual(unexpected, [], `${mode}: browser errors`);
    results.push(`${mode}: real backend login/create/allow/review/approve/reject/block/replay/duplicate/cancel/reload/ledger/filter/CSV/policy passed`);
    await context.close();
  }

  // Boundary fixtures below are deliberately intercepted. No PayPal or AI evidence.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let request = structuredClone(sample);
  request.id = "preq_browser_fixture";
  let payment = {
    id: "pay_browser_fixture", object: "payment", purchase_request_id: request.id,
    status: "AWAITING_PAYER", version: 1, amount: request.amount,
    paypal: { environment: "sandbox", order_id: "FIXTURE_ORDER", order_status: "CREATED", capture_id: null, capture_status: null, payer_action_url: "https://www.sandbox.paypal.com/checkoutnow?token=FIXTURE_ORDER" },
    attempts: [], failure: null, created_at: request.created_at, updated_at: request.updated_at,
  };
  request.payment = { id: payment.id, status: payment.status, paypal_order_id: payment.paypal.order_id, paypal_capture_id: null };
  request.decision.expires_at = new Date(Date.now() + 1800000).toISOString();
  let reconciles = 0;
  let captures = 0;
  let payerCancels = 0;
  let restarts = 0;
  let signedIn = true;
  let captureOutcome = null;
  let sdkRenders = 0;
  let sdkCloses = 0;
  let sdkFail = false;
  let failRequest = false;
  let latestQuery;
  await page.exposeFunction("qaRestarted", () => { restarts++; });
  await page.exposeFunction("qaSdkRendered", () => { sdkRenders++; });
  await page.exposeFunction("qaSdkClosed", () => { sdkCloses++; });
  await context.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.replace("/api/v1/", "");
    if (resource === "session") {
      if (route.request().method() === "POST") signedIn = true;
      return signedIn ? json(route, { user: { id: "usr_browser", name: "QA fixture", role: "reviewer" } })
        : json(route, { error: { code: "UNAUTHENTICATED", message: "Sign in required.", status: 401, request_id: "req_session_fixture", retryable: false } }, 401);
    }
    if (resource === "checkout/config") return json(route, { paypal_client_id: "fixture", currency: "USD", intent: "capture" });
    if (resource === "purchase-requests") return json(route, { object: "list", data: [request], next_cursor: null, summary: { needs_review: 0, allowed_today: request.amount } });
    if (resource === `purchase-requests/${request.id}`) return failRequest
      ? json(route, { error: { code: "INTERNAL", message: "Controlled test outage.", status: 503, request_id: "req_outage_fixture", retryable: true } }, 503)
      : json(route, request);
    if (resource === `purchase-requests/${request.id}/checkout`) return json(route, { purchase_request: request, payment });
    if (resource === `payments/${payment.id}`) return json(route, payment);
    if (resource.endsWith("/reconcile")) { reconciles++; return json(route, { purchase_request: request, payment }); }
    if (resource.endsWith("/capture")) {
      captures++;
      if (captureOutcome === "decline") {
        payment.status = "DECLINED";
        payment.attempts = [{ n: 1, status: "declined", paypal_request_id: "cap_fixture_1", paypal_debug_id: null, issue: "INSTRUMENT_DECLINED", at: request.created_at }];
        payment.failure = { code: "PAYMENT_DECLINED", paypal_issue: "INSTRUMENT_DECLINED", message: "Funding source declined. No payment was taken.", retryable: true };
        request.status = "PAYMENT_FAILED";
        request.next_actions = ["retry_payment", "cancel"];
      } else if (captureOutcome === "complete") {
        payment.status = "COMPLETED";
        payment.failure = null;
        payment.paypal.capture_status = "COMPLETED";
        payment.paypal.capture_id = "FIXTURE_CAPTURE";
        request.status = "PAID";
        request.next_actions = [];
        request.payment.paypal_capture_id = "FIXTURE_CAPTURE";
        request.keys.payer = { state: "granted", by: "PayPal payer", at: new Date().toISOString(), detail: "Verified payer approval" };
      }
      return json(route, { purchase_request: request, payment });
    }
    if (resource.endsWith("/payer-cancel")) { payerCancels++; return json(route, { ok: true }); }
    if (resource === "audit-events/verify") return json(route, { ok: true, events: 0, head_hash: "0".repeat(64) });
    if (resource === "audit-events") { latestQuery = url.searchParams; return json(route, { object: "list", data: [], next_cursor: null }); }
    return json(route, { error: { code: "NOT_FOUND", message: "Test fixture route missing.", status: 404, request_id: "req_fixture", retryable: false } }, 404);
  });
  await context.route("https://www.paypal.com/sdk/js?**", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: sdkFail ? "/* SDK unavailable: deliberate test */" : `window.paypal={Buttons(options){return {async render(el){window.qaSdkRendered();const b=document.createElement('button');b.textContent='QA SDK fixture';b.onclick=async()=>{await options.createOrder();};const approve=document.createElement('button');approve.textContent='QA payer approval fixture';approve.onclick=()=>options.onApprove({orderID:'FIXTURE_ORDER'},{restart:async()=>{await window.qaRestarted();}});el.append(b,approve);},close(){window.qaSdkClosed();}}}};` });
  });
  await page.goto(`${BASE}/requests/${request.id}/checkout`);
  await page.getByRole("button", { name: "QA SDK fixture", exact: true }).waitFor();
  await page.getByRole("button", { name: "QA SDK fixture", exact: true }).click();
  await delay(6500);
  assert.equal(sdkRenders, 1, "polling must not re-render the SDK button");
  assert.equal(sdkCloses, 0, "polling must not close the payer popup");
  assert.equal(captures, 0, "creating an order must never capture");
  await shot(page, "desktop-fixture-sdk-stable");
  captureOutcome = "decline";
  await page.getByRole("button", { name: "QA payer approval fixture", exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes("Funding source declined"));
  assert.equal(restarts, 1, "known funding decline must restart payer approval");
  assert.ok(page.url().endsWith("/checkout"));
  captureOutcome = "complete";
  await page.getByRole("button", { name: "QA payer approval fixture", exact: true }).click();
  await page.waitForURL(/\/payments\/pay_browser_fixture$/);
  await page.getByText("Paid.", { exact: true }).waitFor();
  assert.equal(payment.paypal.order_id, "FIXTURE_ORDER");
  captureOutcome = null;
  payment.status = "AWAITING_PAYER";
  payment.paypal.capture_id = null;
  payment.paypal.capture_status = null;
  payment.attempts = [];
  request.status = "CHECKOUT_PENDING";
  request.payment.paypal_capture_id = null;
  request.next_actions = ["resume_checkout", "cancel"];
  request.keys.payer = { state: "waiting", by: null, at: null, detail: "PayPal approval required" };

  await page.goto(`${BASE}/payments/${payment.id}`);
  await page.getByText("Waiting for payer.", { exact: true }).waitFor();
  await shot(page, "desktop-fixture-awaiting-payer");
  payment.status = "APPROVED";
  request.keys.payer = { state: "granted", by: "PayPal payer", at: new Date().toISOString(), detail: "Verified payer approval" };
  payment.paypal.order_status = "APPROVED";
  request.next_actions = ["resume_checkout", "cancel"];
  await page.getByText("Payer approved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Confirm payment", exact: true }).waitFor();
  assert.equal(await page.getByText("Paid.", { exact: true }).count(), 0);
  captureOutcome = "complete";
  await page.getByRole("button", { name: "Confirm payment", exact: true }).click();
  await page.getByText("Paid.", { exact: true }).waitFor();
  captureOutcome = null;
  payment.paypal.capture_id = null;
  payment.paypal.capture_status = null;
  request.payment.paypal_capture_id = null;
  payment.status = "CAPTURING";
  request.status = "CAPTURING";
  request.next_actions = [];
  payment.attempts = [{ n: 1, status: "unknown", paypal_request_id: "cap_fixture_1", paypal_debug_id: null, issue: null, at: request.created_at }];
  await page.getByText("Confirming.", { exact: true }).waitFor();
  await delay(6500);
  assert.ok(reconciles >= 1, "reconciliation must survive payment polling");
  assert.equal(await page.getByRole("link", { name: "Try payment again", exact: true }).count(), 0);
  await shot(page, "desktop-fixture-unknown-capture");
  payment.status = "PENDING";
  request.status = "PAYMENT_PENDING";
  await page.getByText("Payment pending.", { exact: true }).waitFor();
  await shot(page, "desktop-fixture-payment-pending");
  payment.status = "COMPLETED";
  payment.paypal.capture_status = "COMPLETED";
  payment.paypal.capture_id = "FIXTURE_CAPTURE";
  await delay(1800);
  assert.equal(await page.getByText("Paid.", { exact: true }).count(), 0, "payment alone cannot establish paid");
  request.status = "PAID";
  request.payment.paypal_capture_id = "FIXTURE_CAPTURE";
  await page.getByText("Paid.", { exact: true }).waitFor();
  await shot(page, "desktop-fixture-paid-matched-evidence");

  payment.status = "DECLINED";
  request.keys.payer = { state: "waiting", by: null, at: null, detail: "PayPal approval required" };
  payment.failure = { code: "PAYMENT_DECLINED", paypal_issue: "INSTRUMENT_DECLINED", message: "Funding source declined. No payment was taken.", retryable: true };
  request.status = "PAYMENT_FAILED";
  request.next_actions = ["retry_payment", "cancel"];
  await page.getByText("Not paid.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Try payment again", exact: true }).waitFor();
  await shot(page, "desktop-fixture-declined-retry");

  // SDK load failure and recovery never fabricate an order or capture.
  sdkFail = true;
  await page.goto(`${BASE}/requests/${request.id}/checkout`);
  await page.getByRole("button", { name: "Reload checkout", exact: true }).waitFor();
  await shot(page, "desktop-fixture-sdk-unavailable");
  sdkFail = false;
  await page.getByRole("button", { name: "Reload checkout", exact: true }).click();
  await page.getByRole("button", { name: "QA SDK fixture", exact: true }).waitFor();
  await shot(page, "desktop-fixture-sdk-recovered");

  // Redirect callbacks use the stored payment, preserve sign-in recovery and never trust a token.
  request.status = "CHECKOUT_PENDING";
  request.next_actions = ["resume_checkout", "cancel"];
  payment.status = "AWAITING_PAYER";
  const beforeReturn = captures;
  await page.goto(`${BASE}/checkout/return?payment=${payment.id}&token=UNTRUSTED_ORDER`);
  await page.waitForURL(/\/payments\/pay_browser_fixture$/);
  await page.getByText("Waiting for payer.", { exact: true }).waitFor();
  assert.equal(captures, beforeReturn + 1);
  await page.goto(`${BASE}/checkout/cancel?payment=${payment.id}`);
  await page.waitForURL(/\/payments\/pay_browser_fixture$/);
  assert.ok(payerCancels >= 1);
  signedIn = false;
  const beforeSignIn = captures;
  await page.goto(`${BASE}/checkout/return?payment=${payment.id}&token=UNTRUSTED_ORDER`);
  await page.waitForURL(/\/login\?next=/);
  assert.ok(new URL(page.url()).searchParams.get("next").includes(`payment=${payment.id}`));
  assert.equal(captures, beforeSignIn);
  await page.getByLabel("Passcode", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/payments\/pay_browser_fixture$/);
  await page.getByText("Waiting for payer.", { exact: true }).waitFor();
  assert.equal(captures, beforeSignIn + 1);

  // Expired policy removes all payer controls, without altering the backend.
  request.decision.expires_at = new Date(Date.now() - 1000).toISOString();
  await page.goto(`${BASE}/requests/${request.id}/checkout`);
  await page.getByText("Checkout isn't available for this request.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "QA SDK fixture", exact: true }).count(), 0);
  await shot(page, "desktop-fixture-expired-approval");

  payment.status = "DECLINED";
  request.status = "PAYMENT_FAILED";
  // Slow resource navigation cannot display a previous request under the next request URL.
  await page.goto(`${BASE}/payments/${payment.id}`);
  await page.getByText("Not paid.", { exact: true }).waitFor();
  await page.route("**/api/v1/payments/pay_slow_fixture", async (route) => { await delay(1500); return json(route, { ...payment, id: "pay_slow_fixture", purchase_request_id: "preq_slow_fixture" }); });
  await page.evaluate(() => { const a = document.createElement("a"); a.href = "/payments/pay_slow_fixture"; a.textContent = "Slow payment"; document.body.append(a); });
  await page.getByRole("link", { name: "Slow payment", exact: true }).click();
  assert.equal(await page.getByText("Not paid.", { exact: true }).count(), 0, "stale payment leaked across resource keys");
  await shot(page, "desktop-fixture-loading-new-payment");
  await page.goto(`${BASE}/ledger`);
  await delay(250);
  assert.equal(latestQuery.get("limit"), "100");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    request.status = "ALLOWED";
    request.next_actions = ["start_checkout", "cancel"];
    await page.goto(`${BASE}/requests/${request.id}`);
    await page.getByText("Allowed.", { exact: true }).waitFor();
    await shot(page, `responsive-${width}-request`);
  }
  failRequest = true;
  await page.getByText("Connection interrupted. Showing the last confirmed state.", { exact: true }).waitFor();
  await page.getByText("Allowed.", { exact: true }).waitFor();
  await shot(page, "desktop-fixture-stale-state-recovery");
  failRequest = false;
  await page.getByRole("button", { name: "Refresh status", exact: true }).click();
  await page.getByText("Connection interrupted. Showing the last confirmed state.", { exact: true }).waitFor({ state: "hidden" });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`${BASE}/requests/${request.id}`);
  await page.getByText("Allowed.", { exact: true }).waitFor();
  await shot(page, "dark-reduced-motion-request");
  assert.deepEqual(errors, [], "fixture browser runtime errors");
  results.push("intercepted boundary: stable SDK, unavailable/reload, expired approval, awaiting/approved/unknown/pending/declined/paid evidence, reconciliation, resource loading, 375/768/1280, dark/reduced-motion passed");
  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ evidence: "Real backend UI plus intercepted boundary tests; no genuine PayPal or OpenAI verification", results }, null, 2));
  results.forEach((result) => console.log("PASS", result));
})().catch((error) => { console.error(error); process.exit(1); });
