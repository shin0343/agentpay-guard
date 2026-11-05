# Submission checklist

Deadline: **Thursday 2026-11-12, 12:00 PM PST** (internal target: 2026-11-11 20:00 PST).
Requirements quoted from https://paypalaihackathon.devpost.com/rules (read 2026-11-05).

Legend: ✅ done in the repo · ⏳ needs you · ⚠️ decision needed

## Devpost rules → status

| Rule | Status | Where |
|---|---|---|
| Integrates the PayPal developer platform (Sandbox) and an AI tool, PayPal central | ✅ | Orders v2, JS SDK, webhooks; Meta `muse-spark-1.3` |
| Text description of features and functionality | ✅ draft | `docs/DEVPOST_SUBMISSION.md` |
| Functional demo: setup and run instructions **or** hosted URL ("design mockup … does not meet this") | ✅ instructions | README "Run it": mock mode (no accounts) and live Sandbox mode |
| Public GitHub/GitLab/Bitbucket repo with all source, assets and instructions | ⏳ | Repo is local only. Push when you approve |
| Open-source license detectable in the repo About section | ✅ file / ⏳ visibility | `LICENSE` (MIT); GitHub detects it after push |
| Video under 3 minutes | ✅ draft | `qa/step7-video/agentpay-guard-demo-draft.mp4` |
| Video public on YouTube, link on the form | ⏳ | Upload, then set visibility to Public |
| No third-party trademarks or copyrighted music/material without permission | ✅ / ⚠️ | No music. Shows PayPal's official checkout button (sponsor's own SDK) and names Meta's model. Your call whether that needs mention |
| English materials | ✅ | All docs and narration |
| Testing access free and unrestricted until judging ends (2026-12-15) | ✅ / ⚠️ | Mock mode needs nothing. Live mode needs the judge's own Sandbox app, or you share a revocable one privately |
| "Include any test account credentials, API keys, or sandbox login details" | ⚠️ | Never in the repo. Optional: a separate, revocable Sandbox app in the Devpost private testing field |
| New project during the submission period (Oct 1 – Nov 12) | ✅ | First commit 2026-11-03 |

## Repository before going public

- [x] `LICENSE` (MIT) and `"license": "MIT"` in `package.json`
- [x] README: purpose, evidence, setup (mock + live), env example, Sandbox accounts, AI provider, database, scenarios, tests, troubleshooting, limitations
- [x] `docs/ARCHITECTURE.md`
- [x] `.env.example` contains no values; `.env*` and `qa/` are git-ignored
- [x] Secret scan: PayPal client ID/secret, Meta key, session secret, agent key and both passcodes have **zero** matches in the working tree and in every commit
- [x] No raw webhook receipts or payer data tracked (they live only in ignored `qa/`)
- [x] Clean-copy check: tracked files only, no `.env.local` → `pnpm install --frozen-lockfile` and mock build pass
- [ ] ⚠️ Commit author email `shin0343@mail.hongik.ac.kr` becomes public with the history. Keep it, or rewrite authorship before the first push
- [ ] ⏳ Create the GitHub repo, push `main`, add description and topics from `docs/DEVPOST_SUBMISSION.md`
- [ ] ⏳ Confirm the About panel shows "MIT license"

## Video

- [x] Draft rendered: 1920×1080, H.264/AAC, under 3:00, captions file alongside
- [x] Only real application footage and two plain title cards; no stock footage, no music
- [x] Payment labelled as PayPal Sandbox; "not a production deployment" on the closing card
- [x] No passcodes, keys, emails or payer data on screen (passcode fields are masked)
- [ ] ⏳ Watch it once end to end yourself
- [ ] ⚠️ Keep the synthetic voice (macOS "Samantha") or record your own voice from `docs/DEMO_NARRATION.md`
- [ ] ⏳ Upload to YouTube (Public), paste the description from `docs/DEVPOST_SUBMISSION.md`, add the `.srt` captions

## Devpost form

- [ ] ⏳ Project name, elevator pitch, description (copy from `docs/DEVPOST_SUBMISSION.md`)
- [ ] ⏳ Built-with tags
- [ ] ⏳ GitHub URL and YouTube URL
- [ ] ⏳ Testing instructions (section in `docs/DEVPOST_SUBMISSION.md`)
- [ ] ⏳ Image gallery: `docs/screenshots/step7-*.png` (desktop paid, blocked, review, ledger, landing)
- [ ] ⏳ Choose prize categories (suggested: Best Use of Agentic Commerce, Best Use of PayPal + AI)
- [ ] ⏳ Submit before the deadline, then reopen the public page and check every link

## Day-of sanity check (optional live demo)

1. Start PostgreSQL and the app with `.env.local`. Sign in as operator **before** checkout.
2. Webhooks need a new HTTPS tunnel; follow `docs/WEBHOOK_VERIFICATION.md` "Reproduction". Do not reuse the stopped URL.
3. Never show `.env.local`, terminal history with keys, or PayPal account pages with personal data on screen.
