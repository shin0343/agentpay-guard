// Demo recorder for the Step 7 video (docs/SHOT_LIST.md). Drives the real app and captures
// 1920x1080 frames over the Chrome DevTools screencast. Playwright is not a project dependency:
//   mkdir -p /tmp/apg-qa && (cd /tmp/apg-qa && npm i playwright@1.64.1 && npx playwright install chromium)
//   NODE_PATH=/tmp/apg-qa/node_modules node scripts/demo/record-demo.cjs <out-dir> [segment,...]
// Env: BASE (default http://127.0.0.1:3200). Reads passcodes and the agent key from .env.local;
// never prints them. Run against a disposable clone of your database: it creates real requests.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE || "http://127.0.0.1:3200";
const OUT = process.argv[2];
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;
fs.mkdirSync(OUT, { recursive: true });
const env = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))[1].trim();
const codes = Object.fromEntries(get("DEMO_PASSCODES").split(",").map((v) => [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)]));
const AGENT_KEY = get("DEMO_AGENT_KEY");
const CARDS = "file://" + path.join(__dirname, "cards.html");
const PAID = "preq_01M6PAT02AJK7SF54JHJ7W5CQ8";
// Optional {segment: seconds} from narrate.py timing (lead + narration + tail). Segments hold until reached.
const TARGETS = process.env.TARGETS_FILE ? JSON.parse(fs.readFileSync(process.env.TARGETS_FILE, "utf8")) : {};
// Optional narrate.py timing.json: lets a scene act on the sentence that describes it.
const TIMING = process.env.TIMING_FILE ? JSON.parse(fs.readFileSync(process.env.TIMING_FILE, "utf8")) : {};
const LEAD = 0.5; // must match assemble-demo.py
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── Overlay: cursor, click ring, caption, highlight. Recording aid only, never product UI. ──
const OVERLAY = () => {
  const boot = () => {
    if (document.getElementById("__demo")) return;
    const root = document.createElement("div");
    root.id = "__demo";
    root.innerHTML = `
      <style>
        #__demo { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
        #__cur { position: fixed; left: 0; top: 0; width: 22px; height: 22px; transform: translate(-100px,-100px); }
        .__ring { position: fixed; width: 34px; height: 34px; margin: -17px 0 0 -17px; border: 2px solid #16150F; border-radius: 999px; opacity: .5; animation: __r 420ms ease-out forwards; }
        @keyframes __r { from { transform: scale(.4); opacity: .55 } to { transform: scale(1.25); opacity: 0 } }
        #__cap { position: fixed; left: 28px; bottom: 26px; max-width: 900px; padding: 9px 14px; border-radius: 6px; background: #16150F; color: #F4F2EC;
          font: 500 12.5px/18px var(--font-geist-mono), ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; opacity: 0; transform: translateY(6px);
          transition: opacity 260ms cubic-bezier(.2,.8,.2,1), transform 260ms cubic-bezier(.2,.8,.2,1); }
        #__cap.on { opacity: 1; transform: none; }
        .__hl { position: fixed; border: 2px solid #2F4FD8; border-radius: 10px; opacity: 0; transition: opacity 240ms ease; box-shadow: 0 0 0 4px rgb(47 79 216 / .12); }
        .__hl.on { opacity: 1; }
      </style>
      <svg id="__cur" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.5 L13.4 19.2 L10.4 12.7 L16.5 12.7 Z" fill="#16150F" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <div id="__cap"></div>`;
    document.documentElement.appendChild(root);
    const cur = root.querySelector("#__cur");
    const place = (x, y) => { cur.style.transform = `translate(${x - 3}px, ${y - 2}px)`; try { sessionStorage.setItem("__xy", JSON.stringify([x, y])); } catch {} };
    try { const s = JSON.parse(sessionStorage.getItem("__xy") || "null"); if (s) place(s[0], s[1]); } catch {}
    addEventListener("mousemove", (e) => place(e.clientX, e.clientY), true);
    addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "__ring"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; root.appendChild(r); setTimeout(() => r.remove(), 500); }, true);
    window.__cap = (t) => { const c = root.querySelector("#__cap"); if (!t) { c.classList.remove("on"); return; } c.textContent = t; c.classList.add("on"); };
    window.__hl = (b, ms) => { const h = document.createElement("div"); h.className = "__hl"; Object.assign(h.style, { left: b.x - 6 + "px", top: b.y - 6 + "px", width: b.width + 12 + "px", height: b.height + 12 + "px" }); root.appendChild(h); requestAnimationFrame(() => h.classList.add("on")); setTimeout(() => { h.classList.remove("on"); setTimeout(() => h.remove(), 300); }, ms); };
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", () => setTimeout(boot, 50)); else setTimeout(boot, 50);
};

(async () => {
  const browser = await chromium.launch({ args: ["--force-device-scale-factor=1.3333333", "--window-size=1440,810", "--hide-scrollbars"] });
  const ctx = await browser.newContext({ viewport: null });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  let frames = [];
  let recording = false;
  cdp.on("Page.screencastFrame", async (f) => {
    if (recording) frames.push({ ts: f.metadata.timestamp, wall: Date.now() / 1000, data: f.data });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
  });

  const wait = (ms) => page.waitForTimeout(ms);
  const cap = (t) => page.evaluate((t) => window.__cap && window.__cap(t), t);
  async function moveTo(loc) {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const x = b.x + Math.min(b.width / 2, 120), y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 28 });
    return { x, y };
  }
  async function click(loc, pause = 260) { await moveTo(loc); await wait(pause); await page.mouse.down(); await wait(70); await page.mouse.up(); }
  async function hl(loc, ms = 2200) { const b = await loc.boundingBox(); await page.evaluate(([b, ms]) => window.__hl(b, ms), [b, ms]); }
  async function scrollTo(loc, block = "center") { await loc.evaluate((el, block) => el.scrollIntoView({ behavior: "smooth", block }), block); await wait(900); }
  async function scrollTop() { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await wait(700); }

  let startWall = 0;
  async function start(name) {
    frames = [];
    startWall = Date.now();
    recording = true;
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    log("REC", name);
  }
  // Wait until narration cue `i` of `seg` starts (plus `early` seconds, negative = before). No-op without timing.
  async function atCue(seg, i, early = 0) {
    const c = TIMING[seg]?.cues?.[i];
    if (!c) return;
    const ms = (LEAD + c.start + early) * 1000 - (Date.now() - startWall);
    if (ms > 0) await wait(ms);
  }
  async function stop(name) {
    const hold = (TARGETS[name] ?? 0) * 1000 - (Date.now() - startWall);
    if (hold > 0) await wait(hold);
    const stopWall = Date.now() / 1000;
    await cdp.send("Page.stopScreencast");
    recording = false;
    const dir = path.join(OUT, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, "seq"), { recursive: true });
    frames.forEach((f, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64")));
    // Constant 30 fps: each output frame shows the latest captured frame at that moment (CDP clock).
    const last = frames[frames.length - 1];
    const t0 = frames[0].ts, t1 = last.ts + (stopWall - last.wall);
    const n = Math.max(1, Math.round((t1 - t0) * 30));
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t = t0 + k / 30;
      while (j + 1 < frames.length && frames[j + 1].ts <= t) j++;
      fs.symlinkSync(path.join(dir, `f${String(j).padStart(5, "0")}.jpg`), path.join(dir, "seq", `${String(k).padStart(6, "0")}.jpg`));
    }
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", "30", "-i", path.join(dir, "seq", "%06d.jpg"),
      "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-r", "30", path.join(OUT, `${name}.mp4`)]);
    fs.rmSync(dir, { recursive: true, force: true });
    log("SAVED", name, frames.length, "frames,", (t1 - t0).toFixed(1), "s,", n, "output frames");
  }
  const want = (n) => !ONLY || ONLY.includes(n);

  // The request list auto-selects its newest row. Start scenario scenes on Policies with the sheet open instead.
  async function openSheet() {
    await page.goto(BASE + "/policies"); await wait(1200);
    await page.getByRole("button", { name: "Send test request" }).first().click();
    await page.getByRole("button", { name: "Send as agent" }).waitFor();
    await page.mouse.move(1500, 330); await wait(900);
  }
  async function sendScenario(title) {
    await click(page.getByText(title, { exact: true }));
    await wait(450);
    await click(page.getByRole("button", { name: "Send as agent" }));
    await page.waitForURL(/\/requests\/preq_/);
  }

  // Sends a scenario through the same endpoint the sheet uses (operator session + CSRF), without waiting
  // for the decision, then opens Requests client-side so the newest row is this request while it evaluates.
  async function runAndOpen(key, title) {
    await page.goto(BASE + "/policies"); await wait(1000);
    await page.evaluate((key) => {
      const csrf = document.cookie.split("; ").find((c) => c.startsWith("apg_csrf="))?.slice(9) ?? "";
      window.__run = fetch(`/api/v1/demo/scenarios/${key}/run`, {
        method: "POST", credentials: "same-origin", body: "{}",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "Idempotency-Key": crypto.randomUUID() },
      }).then((r) => r.json());
    }, key);
    await wait(700);
    await page.getByRole("link", { name: "Requests" }).first().click();
    await page.waitForURL(/\/requests$/);
    await page.getByRole("heading", { name: title }).first().waitFor({ timeout: 15000 });
    await page.mouse.move(1500, 330);
  }
  const runResult = () => page.evaluate(() => window.__run);

  async function signIn(role) {
    await page.goto(BASE + "/login");
    await page.getByLabel("Passcode").fill(codes[role]);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/requests/);
  }

  // 01 — intro card
  if (want("01-intro")) {
    await page.goto(CARDS + "#intro");
    await page.evaluate(() => document.fonts.ready);
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    await start("01-intro"); await wait(2500); await stop("01-intro");
  }

  // 02 — landing + hero trace
  if (want("02-product")) {
    await page.goto(BASE + "/"); await wait(1200);
    await page.mouse.move(700, 600);
    await start("02-product");
    await atCue("02-product", 1, -0.9);
    await click(page.getByRole("tab", { name: "$2,400 gift cards" }));
    await wait(350);
    await click(page.getByRole("button", { name: /Run decision/ }));
    await atCue("02-product", 2, 0.2);
    const boundary = page.getByText(/AI can raise caution, never lower it/).first();
    await scrollTo(boundary);
    await hl(boundary, 3200);
    await atCue("02-product", 3, -0.6);
    await page.mouse.move(1380, 980, { steps: 20 });
    await scrollTo(page.locator("#ledger"), "start");
    await hl(page.locator("#ledger li", { hasText: "CHECKOUT.ORDER.APPROVED" }), 2400);
    await wait(1300);
    await hl(page.locator("#ledger li", { hasText: "payment.completed" }), 2400);
    await stop("02-product");
  }

  // 03 — fresh low-risk request through the real agent API, then checkout handoff.
  if (want("03-allow")) {
    await signIn("operator");
    await page.goto(BASE + "/policies"); await wait(1500);
    await page.mouse.move(900, 300);
    await start("03-allow");
    await cap("Eight deterministic rules · rule set v3");
    await wait(2600);
    await cap("Agent → POST /api/v1/purchase-requests · research-assistant key");
    await wait(600);
    const body = {
      agent_reference: "index-docs/run-91",
      merchant: { name: "Larkspur Data", domain: "larkspur-data.example", category: "api_credits" },
      items: [{ name: "Embedding API credits · 100k tokens", quantity: 1, unit_amount: { currency_code: "USD", value: "18.00" } }],
      amount: { currency_code: "USD", value: "18.00" },
      justification: "Top up embedding credits to finish indexing the onboarding docs (about 80k tokens left).",
    };
    const res = await fetch(BASE + "/api/v1/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AGENT_KEY}`, "Idempotency-Key": `step7-demo-${Date.now()}` },
      body: JSON.stringify(body),
    });
    const created = await res.json();
    log("agent API", res.status, created.id ?? JSON.stringify(created).slice(0, 200));
    fs.writeFileSync(path.join(OUT, "03-allow-request.txt"), String(created.id));
    await click(page.getByRole("link", { name: "Requests" }).first());
    await page.waitForURL(/\/requests/);
    const row = page.locator(`a[href$="${created.id}"]`).first();
    await row.waitFor({ timeout: 15000 });
    await wait(600);
    await click(row);
    await page.waitForURL(/preq_/);
    await cap("Live Meta inference · muse-spark-1.3 · advisory only");
    await page.getByText("Allowed.", { exact: true }).waitFor({ timeout: 30000 });
    await wait(1800);
    await hl(page.locator('section[aria-label="Approval keys"]'), 2600);
    await wait(2800);
    await scrollTo(page.getByText(/^model /).first());
    await hl(page.getByText(/^model /).first(), 2400);
    await wait(2600);
    await scrollTop();
    await cap("PayPal JS SDK · Sandbox · no order is created until the payer clicks");
    await click(page.getByRole("link", { name: "Continue to PayPal" }).first());
    await page.waitForURL(/checkout/);
    await page.locator("iframe").first().waitFor({ timeout: 20000 }).catch(() => {});
    await wait(5200);
    await cap(null);
    await stop("03-allow");
  }

  // 06 — injected request is blocked (recorded before the reviewer sign-in).
  if (want("06-block")) {
    await signIn("operator");
    // C_ID: open a request already evaluated earlier in this session (used when live Meta inference timed out).
    if (process.env.C_ID) { await page.goto(`${BASE}/requests/${process.env.C_ID}`); await wait(1500); await page.mouse.move(1500, 330); }
    else await runAndOpen("c_blocked", "Digital gift card · $200");
    await start("06-block");
    if (process.env.C_ID) {
      await cap(process.env.C_NOTE || "Scenario C · evaluated earlier in this session · rules decide");
    } else {
      await cap("Scenario C · sent as growth-agent · live Meta inference · rules decide");
    }
    await page.getByText("Blocked.", { exact: true }).waitFor({ timeout: 30000 });
    await atCue("06-block", 1, -0.5);
    const quote = page.locator('section[aria-label="What the agent said"]');
    await scrollTo(quote);
    await hl(quote, 3600);
    await atCue("06-block", 2, -0.4);
    const inj = page.getByText("Instruction pattern", { exact: false }).first();
    await scrollTo(inj);
    await hl(inj.locator("xpath=ancestor::li[1]"), 3000).catch(() => hl(inj, 3000));
    await atCue("06-block", 3, -0.5);
    const p01 = page.locator("tr", { hasText: "amount_auto_limit" }).first();
    await scrollTo(p01);
    await hl(page.locator("tr", { hasText: "blocked_category" }).first(), 3200);
    await wait(500);
    await hl(p01, 2700);
    await atCue("06-block", 4, -0.5);
    const calls = page.getByText("PayPal calls", { exact: true });
    await scrollTo(calls);
    await hl(calls.locator("xpath=.."), 2000);
    await atCue("06-block", 5, -0.2);
    const ledger = page.getByRole("heading", { name: "Ledger for this request" }).locator("xpath=ancestor::section[1]");
    await scrollTo(ledger);
    await hl(ledger, 3400);
    await cap(null);
    await stop("06-block");
    fs.writeFileSync(path.join(OUT, "06-block-request.txt"), page.url());
  }

  // 08 — retry replay + ledger evidence (operator; recorded before reviewer sign-in).
  if (want("08-ledger")) {
    await signIn("operator");
    await openSheet();
    await start("08-ledger");
    await sendScenario("Network retry");
    await cap("Same Idempotency-Key → original response replayed");
    await wait(1200);
    await hl(page.getByText("Retry replayed. No new request was created.").locator("xpath=ancestor::*[2]"), 2600);
    await wait(3000);
    await click(page.getByRole("link", { name: "Ledger" }).first());
    await page.waitForURL(/ledger/);
    await wait(1200);
    await cap("Signed webhook from the 2026-11-05 Sandbox run · verified with PayPal");
    const hook = page.getByRole("button", { name: "webhook.received" }).first();
    await click(hook);
    await wait(900);
    const detail = page.locator("tr[id^='evt-']").first();
    await scrollTo(detail);
    await hl(detail, 4400);
    await wait(4600);
    await scrollTop();
    await hl(page.getByText(/Chain verified/), 2600);
    await wait(3000);
    await cap(null);
    await stop("08-ledger");
  }

  // 04 + 05 — human review boundary, then reviewer approval.
  if (want("04-review")) {
    await signIn("operator");
    await runAndOpen("b_needs_review", "GPU hours · H-class");
    await start("04-review");
    await cap("Scenario B · sent as research-assistant · live Meta inference");
    const reviewId = (await runResult()).purchase_request.id;
    fs.writeFileSync(path.join(OUT, "04-review-request.txt"), reviewId);
    await page.getByText("Needs review.", { exact: true }).waitFor({ timeout: 30000 });
    await wait(1500);
    await hl(page.locator("tr", { hasText: "amount_auto_limit" }).first(), 2200);
    await wait(600);
    await hl(page.locator("tr", { hasText: "merchant_allowlist" }).first(), 1600);
    await wait(1800);
    await page.goto(`${BASE}/review/${reviewId}`);
    await cap("Signed in as operator · cannot grant policy approval");
    await wait(900);
    const notice = page.getByText("Only reviewers can decide.");
    await scrollTo(notice);
    await hl(notice.locator("xpath=ancestor::*[2]"), 2600);
    await wait(3200);
    await cap(null);
    await stop("04-review");

    await page.context().clearCookies();
    await page.goto(`${BASE}/login?next=${encodeURIComponent(`/review/${reviewId}`)}`);
    await wait(800);
    await page.mouse.move(720, 420);
    await start("05-approve");
    await cap("Separate reviewer sign-in");
    await click(page.getByLabel("Passcode"));
    await page.keyboard.type(codes.reviewer, { delay: 45 });
    await click(page.getByRole("button", { name: "Sign in" }));
    await page.waitForURL(/\/review\//);
    await wait(1200);
    const note = page.getByLabel(/Note · required to reject/);
    await scrollTo(note);
    await click(note);
    await page.keyboard.type("Q4 eval budget confirmed with finance.", { delay: 28 });
    await wait(300);
    await click(page.getByRole("button", { name: /Approve purchase/ }).last());
    const confirm = page.getByRole("dialog").getByRole("button", { name: "Approve purchase" });
    if (await confirm.isVisible().catch(() => false)) { await wait(700); await click(confirm); }
    await cap("Policy approval · granted by M. Okafor");
    await page.getByText(/Allowed by/).first().waitFor({ timeout: 15000 });
    await scrollTop();
    await wait(1600);
    await click(page.getByRole("link", { name: "View request" }));
    await page.waitForURL(/\/requests\/preq_/);
    await page.getByText(/Allowed by M\./).first().waitFor({ timeout: 15000 });
    await page.mouse.move(1180, 760, { steps: 20 });
    await wait(700);
    const keys = page.locator('section[aria-label="Approval keys"]');
    await hl(keys, 3200);
    await wait(3600);
    await cap(null);
    await stop("05-approve");
  }

  // 07 — the verified Sandbox payment (reviewer can read it).
  if (want("07-paid")) {
    if (!page.url().startsWith(BASE)) await signIn("operator");
    await page.goto(`${BASE}/requests/${PAID}`); await wait(1800);
    await page.mouse.move(1100, 300);
    await start("07-paid");
    await cap("Earlier Sandbox run · captured 2026-11-05 17:07 UTC · USD 18.00");
    await wait(4200);
    await hl(page.locator('section[aria-label="Approval keys"]'), 3400);
    await wait(3700);
    await click(page.getByRole("link", { name: "View payment" }));
    await page.waitForURL(/payments/);
    await wait(1200);
    const attempts = page.getByText("Capture attempts", { exact: true });
    await scrollTo(attempts, "start");
    await hl(attempts.locator("xpath=.."), 3000);
    await wait(3300);
    await hl(page.getByText("2UE55412FX0764120").locator("xpath=.."), 3000);
    await wait(900);
    await hl(page.getByText("32E66103YN1557633").locator("xpath=.."), 3400);
    await wait(3600);
    await cap(null);
    await stop("07-paid");
  }

  // 09 — closing card
  if (want("09-close")) {
    await page.goto(CARDS + "#close");
    await page.evaluate(() => document.fonts.ready);
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    await start("09-close"); await wait(2500); await stop("09-close");
  }

  await browser.close();
  console.log("page errors:", errors.length ? errors.join("\n") : "none");
})().catch((e) => { console.error(e); process.exit(1); });
