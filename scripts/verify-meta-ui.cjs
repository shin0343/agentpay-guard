/** Recorded genuine Meta/PG display check; GET responses are intercepted.
 * Run after verify-meta.ts with a live-mode build on loopback port 3100.
 * This is not full runtime or payment acceptance. Playwright is scratch-installed.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const records = JSON.parse(fs.readFileSync('qa/meta-live/frontend-records.json', 'utf8'));
const acceptance = JSON.parse(fs.readFileSync('qa/meta-live/risk-evidence.json', 'utf8'));
const selected = acceptance.cases.map(c => ({ name: c.case, request: records.requests.find(r => r.id === c.request.id) }));
const out = 'qa/meta-live/browser-genuine-records';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext({ viewport: mode === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/api/v1/', '');
      let data;
      if (route.request().method() !== 'GET') throw new Error('This recorded-data rendering check never mutates a payment/request.');
      if (path === 'session') data = { user: { id: 'usr_okafor', name: 'M. Okafor', role: 'reviewer' } };
      else if (path === 'purchase-requests') data = { object: 'list', data: records.requests.filter(r => !url.searchParams.get('status') || url.searchParams.get('status').split(',').includes(r.status)), next_cursor: null, summary: { needs_review: 2, allowed_today: { currency_code: 'USD', value: '18.00' } } };
      else if (path.startsWith('purchase-requests/')) data = records.requests.find(r => r.id === path.split('/')[1]);
      else if (path === 'audit-events/verify') data = records.chain;
      else if (path === 'audit-events') data = { object: 'list', data: records.events.filter(e => !url.searchParams.get('purchase_request_id') || e.purchase_request_id === url.searchParams.get('purchase_request_id')).reverse(), next_cursor: null };
      else throw new Error('Unexpected display API path: ' + path);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    for (const { name, request } of selected) {
      await page.goto(`http://127.0.0.1:3100/requests/${request.id}`);
      await page.getByText(request.status === 'ALLOWED' ? 'Allowed.' : request.status === 'BLOCKED' ? 'Blocked.' : 'Needs review.', { exact: true }).waitFor();
      await page.getByText(/muse-spark-1\.3/).first().waitFor();
      await page.getByText(request.evaluation.risk.summary.trim(), { exact: true }).first().waitFor();
      await page.getByText(new RegExp('^' + request.evaluation.risk.score + '\\s*/\\s*100$')).first().waitFor();
      await page.getByText('Risk assessed', { exact: true }).first().waitFor();
      assert.equal(await page.getByText("Couldn't load this.", { exact: true }).count(), 0);
      assert.equal(await page.getByText('Simulated AI assessment', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Paid.', { exact: true }).count(), 0);
      await page.evaluate(() => {
        const label = document.createElement('p');
        label.textContent = 'Recorded genuine Meta + PostgreSQL evaluation · display API intercepted · no PayPal payment';
        label.style.cssText = 'padding:8px 16px;border-bottom:1px solid var(--rule);background:var(--sunken);color:var(--ink);font:13px sans-serif';
        document.body.prepend(label);
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
      await page.screenshot({ path: `${out}/${mode}-${name}.png`, fullPage: true });
      if (request.status === 'IN_REVIEW') {
        await page.goto(`http://127.0.0.1:3100/review/${request.id}`);
        await page.getByRole('heading', { name: 'Why this needs you', exact: true }).waitFor();
        await page.getByText(request.evaluation.risk.signals[0].label, { exact: false }).first().waitFor();
        await page.evaluate(() => {
          const label = document.createElement('p');
          label.textContent = 'Recorded genuine Meta + PostgreSQL evaluation · display API intercepted · no PayPal payment';
          label.style.cssText = 'padding:8px 16px;border-bottom:1px solid var(--rule);background:var(--sunken);color:var(--ink);font:13px sans-serif';
          document.body.prepend(label);
        });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
        await page.screenshot({ path: `${out}/${mode}-${name}-review.png`, fullPage: true });
      }
      results.push({ mode, case: name, score: request.evaluation.risk.score, model: request.evaluation.risk.model, status: request.status, paid: false });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ at: new Date().toISOString(), scope: 'Recorded genuine Meta/PG results; GET display responses intercepted, not full runtime acceptance', results }, null, 2));
  console.log(JSON.stringify({ checks: results.length, screenshots: fs.readdirSync(out).filter(f => f.endsWith('.png')).length, runtime_errors: 0, scope: 'Recorded genuine Meta results; display transport intercepted' }));
})().catch(e => { console.error(e.message); process.exit(1); });
