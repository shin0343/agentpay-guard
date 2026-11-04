/** Optional axe scan using a scratch install; no project dependency or provider call. */
const { chromium } = require("playwright");
if (!process.env.QA_AXE_MODULE || !process.env.QA_PASSCODE) throw new Error("QA_AXE_MODULE and QA_PASSCODE are required.");
const AxeBuilder = require(process.env.QA_AXE_MODULE).default;
const fs = require("node:fs");
const path = require("node:path");
const BASE = process.env.BASE || "http://127.0.0.1:3100";
const OUT = process.argv[2] || "qa/frontend-accessibility";
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Passcode", { exact: true }).fill(process.env.QA_PASSCODE);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/requests$/);
    const list = await (await page.request.get(`${BASE}/api/v1/purchase-requests?limit=100`)).json();
    await page.waitForTimeout(300);
    const firstLink = page.locator('aside a[href^="/requests/preq_"]').first();
    const id = list.data?.[0]?.id || ((await firstLink.count()) ? (await firstLink.getAttribute("href")).split("/").at(-1) : null);
    for (const route of ["/", "/login", "/requests", ...(id ? [`/requests/${id}`] : []), "/ledger", "/policies"]) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(350);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      results.push({ width, route, violations: result.violations });
      console.log(width, route, result.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`).join(", ") || "0 violations");
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, outline: document.activeElement && getComputedStyle(document.activeElement).outlineWidth }));
      if (!focus.tag || focus.tag === "BODY") throw new Error(`No keyboard focus on ${route}`);
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "axe-results.json"), JSON.stringify(results, null, 2));
  if (results.some((result) => result.violations.length)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
