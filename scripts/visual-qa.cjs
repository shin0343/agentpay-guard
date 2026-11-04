/**
 * Visual QA walkthrough — scenarios A–E, desktop or mobile, with screenshots.
 * Fails loudly on console errors and horizontal overflow.
 *
 * Playwright is intentionally NOT a project dependency. Run it from a scratch install:
 *   mkdir -p /tmp/apg-qa && (cd /tmp/apg-qa && npm i playwright@1.64.1 && npx playwright install chromium)
 *   pnpm build && pnpm start -p 3100 &
 *   NODE_PATH=/tmp/apg-qa/node_modules MODE=desktop node scripts/visual-qa.cjs qa/
 *   NODE_PATH=/tmp/apg-qa/node_modules MODE=mobile  node scripts/visual-qa.cjs qa/
 * Env: BASE (default http://localhost:3100). Screens land in the given folder (qa/ is git-ignored).
 * Assumes mock mode with a fresh demo (use "Reset demo" first).
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

async function shot(page, name, full = true) {
  await page.waitForTimeout(250);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (o.sw > o.cw + 1) errors.push(`[overflow] ${name}: scrollWidth ${o.sw} > ${o.cw}`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log("shot", name);
}

async function send(page, letterTitle) {
  await page.getByRole("button", { name: "Send test request" }).first().click();
  await page.getByText(letterTitle, { exact: true }).click();
  await page.getByRole("button", { name: "Send as agent" }).click();
  await page.waitForURL(/\/requests\/preq_/);
}

async function payFlow(page) {
  await page.getByRole("link", { name: /Continue to PayPal|Try payment again/ }).first().click();
  await page.waitForURL(/checkout/);
  await page.getByRole("button", { name: "Open PayPal (simulated)" }).click();
  await page.getByRole("button", { name: "Approve as payer" }).waitFor();
}

(async () => {
  const browser = await chromium.launch();
  const mode = process.env.MODE || "desktop";
  const ctx = await browser.newContext(
    mode === "mobile"
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  const p = mode;

  await page.goto(BASE + "/");
  await shot(page, `${p}-01-landing`);
  await page.getByRole("tab", { name: "$2,400 gift cards" }).click();
  await page.waitForTimeout(3200);
  await shot(page, `${p}-02-landing-hero-blocked`, false);

  await page.goto(BASE + "/requests");
  await page.waitForTimeout(800);
  await shot(page, `${p}-03-requests-seeded`);

  if (mode === "desktop") {
    await page.getByRole("button", { name: "Send test request" }).first().click();
    await page.waitForTimeout(400);
    await shot(page, `${p}-04-sheet`, false);
    await page.keyboard.press("Escape");
  }

  // A
  await send(page, "Low risk");
  await page.waitForTimeout(600);
  await shot(page, `${p}-05-A-evaluating`, false);
  await page.waitForTimeout(3200);
  await shot(page, `${p}-06-A-allowed`);
  await payFlow(page);
  await shot(page, `${p}-07-A-checkout-window`);
  await page.getByRole("button", { name: "Approve as payer" }).click();
  await page.waitForURL(/\/payments\//);
  await page.waitForTimeout(300);
  await shot(page, `${p}-08-A-confirming`, false);
  await page.waitForTimeout(2200);
  await shot(page, `${p}-09-A-paid`);

  // B
  await send(page, "Needs a human");
  await page.waitForTimeout(3600);
  await shot(page, `${p}-10-B-needs-review`);
  await page.getByRole("link", { name: "Open review" }).click();
  await page.waitForURL(/\/review\//);
  await page.waitForTimeout(500);
  await shot(page, `${p}-11-B-review`);
  await page.getByRole("button", { name: /Approve purchase/ }).click();
  await page.waitForTimeout(600);
  await shot(page, `${p}-12-B-approved`, false);

  // C
  await send(page, "High risk");
  await page.waitForTimeout(3600);
  await shot(page, `${p}-13-C-blocked`);

  // D1 + D2
  await send(page, "Network retry");
  await page.waitForTimeout(800);
  await shot(page, `${p}-14-D1-replayed`, false);
  await send(page, "Duplicate purchase");
  await page.waitForTimeout(3600);
  await shot(page, `${p}-15-D2-duplicate`);

  // E
  await send(page, "Payment declined");
  await page.waitForTimeout(3400);
  await payFlow(page);
  await page.getByRole("button", { name: "Approve as payer" }).click();
  await page.waitForURL(/\/payments\//);
  await page.waitForTimeout(2600);
  await shot(page, `${p}-16-E-not-paid`);
  await page.getByRole("link", { name: "Try payment again" }).click();
  await page.waitForURL(/checkout/);
  await page.waitForTimeout(400);
  await shot(page, `${p}-17-E-retry-checkout`);
  await page.getByRole("button", { name: "Open PayPal (simulated)" }).click();
  await page.getByRole("button", { name: "Approve as payer" }).click();
  await page.waitForURL(/\/payments\//);
  await page.waitForTimeout(2600);
  await shot(page, `${p}-18-E-paid-after-retry`);

  // Ledger
  await page.goto(BASE + "/ledger");
  await page.waitForTimeout(800);
  await shot(page, `${p}-19-ledger`, false);
  await page.locator("tbody button[aria-expanded]").first().click();
  await page.waitForTimeout(300);
  await shot(page, `${p}-20-ledger-expanded`, false);

  await page.goto(BASE + "/policies");
  await page.waitForTimeout(600);
  await shot(page, `${p}-21-policies`);

  await page.goto(BASE + "/review");
  await page.waitForTimeout(600);
  await shot(page, `${p}-22-review-empty`, false);

  await page.goto(BASE + "/requests/preq_DOESNOTEXIST");
  await page.waitForTimeout(800);
  await shot(page, `${p}-23-not-found`, false);

  await page.goto(BASE + "/login");
  await shot(page, `${p}-24-login`, false);

  await browser.close();
  fs.writeFileSync(path.join(OUT, `${p}-errors.txt`), errors.join("\n") || "none");
  console.log("errors:", errors.length ? errors : "none");
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error("QA FAILED", e);
  fs.writeFileSync(path.join(OUT, `errors-fatal.txt`), String(e.stack));
  process.exit(1);
});
