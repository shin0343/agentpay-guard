# Publication checklist

Current verdict: **NOT READY — narration licensing only**. Use [FINAL_RELEASE_REPORT.md](FINAL_RELEASE_REPORT.md) and
[FINAL_SUBMISSION_VERIFICATION.md](FINAL_SUBMISSION_VERIFICATION.md), dated 2026-11-05.
No commands here authorize a push, deployment, YouTube upload or Devpost submission.

## Close local release gates first

- [x] Typecheck, lint, Webpack build and full 198-test PostgreSQL suite pass.
- [x] Fresh installation, migration, mock A–E desktop/mobile and real backend/browser recovery pass.
- [x] Existing USD 18.00 capture, one attempt, 106-event chain and four signed webhook receipts rechecked.
- [x] Reachable history/private-value scan, tracked screenshot OCR, dependency/license review completed.
- [x] MIT license, font notices, English README/Devpost copy and release notes prepared.
- [ ] Replace Samantha narration with the entrant's own recording or a voice licensed for public sharing;
      retain permission/license evidence. Apple system voice generation is not public redistribution permission.
- [x] All three unintended-request transitions fixed and independently spot-checked in the final video.
- [x] Final narration/captions distinguish new unpaid proposals from the earlier November 5 capture.
- [x] Current final MP4/SRT hashes and chapter times recorded in the final release report.
- [ ] Watch/listen end to end: every scene transition, caption timing, approval claims, provider labels,
      historical date, screen privacy, sound, and absence of unlicensed music/material.
- [x] Current final is 158.867 seconds. Recheck any audio replacement and record its new hashes.
- [x] Claude video commit reconciled with all reviewed Step 8 audit documents; no work discarded.
- [ ] Decide whether the existing academic author/committer email may become public. No identity rewrite
      is authorized. A future noreply setting cannot remove the address from existing commits.

Final artifact inspection commands (replace paths with the actual selected output):

```sh
ffprobe -v error -show_format -show_streams -of json <final-video.mp4>
ffmpeg -v error -i <final-video.mp4> -f null -
shasum -a 256 <final-video.mp4> <final-captions.srt>
```

Do not publish raw `qa/`, `.env.local`, transient audit output, signed receipt payloads, DB dumps,
or buyer/card/account data. Preserve the original evidence locally. No new payment is needed.

## Controlled local branch promotion

The audited `main` is an ancestor (18 commits behind the video parent, 19 after the reconciliation commit), with no independent commits. Recheck after
all release work is committed. The following procedure makes **no network mutation**:

```sh
cd '/Users/sjh/Hackaton & Contest/agentpay-guard'
git status --short --branch
git diff --check
git diff --stat
# Review actual contents. Stage specific reviewed paths, never all ignored/private evidence.
# git add <explicit reviewed paths>
# git diff --cached
# git commit -m 'docs: complete final release verification'

# Stop unless every intended release change is committed and status is empty.
test -z "$(git status --porcelain)" || exit 1
test "$(git branch --show-current)" = feat/frontend || exit 1
release_commit=$(git rev-parse feat/frontend)
git merge-base --is-ancestor main "$release_commit" || exit 1
git branch "backup/main-before-release-$(date -u +%Y%m%dT%H%M%SZ)" main || exit 1
git switch main || exit 1
git merge --ff-only "$release_commit" || exit 1
test "$(git rev-parse HEAD)" = "$release_commit" || exit 1
git log -1 --format='%H %s'
```

The backup is a local safety ref. Push only the intended main ref later, not `--all` or `--mirror`.
If `main` diverges, stop and inspect; do not reset, force-push or replace unrelated history.
If privacy is desired for future commits, copy your actual GitHub-provided noreply address from
[email settings](https://github.com/settings/emails), then set `git config --local user.email` to that
exact value. Existing history must remain untouched unless separately authorized to rewrite it.

## GitHub — only after explicit authorization

1. Create an **empty public repository**, without a generated README/license/initial commit.
2. Set the actual chosen URL locally; no remote exists in the audited repository:

   ```sh
   git remote -v
   test -z "$(git remote)" || exit 1
   git remote add origin <actual-empty-repository-url> || exit 1
   remote_refs=$(git ls-remote origin) || exit 1
   # Stop on pre-existing history; reconcile it through review.
   test -z "$remote_refs" || exit 1
   git push --dry-run origin main:main || exit 1
   # Requires explicit publication authorization:
   git push --set-upstream origin main:main
   ```

3. Open the repository while signed out. Confirm source, README images/setup, license link and GitHub
   About/license detection show MIT. Actual hosted detection cannot be verified before publication.
4. Set description/topics from `DEVPOST_SUBMISSION.md`. Use [RELEASE_NOTES.md](RELEASE_NOTES.md) if creating
   a release; attach only reviewed public assets. Enable available secret/dependency alerts.
5. Record the exact public URL and final release commit in the verification documents and Devpost draft.

## YouTube — only after explicit authorization

1. Select the rights-cleared, inspected final MP4, after replacing the current final's Samantha narration.
2. Upload as **Public**. Add the matching English SRT; verify captions in YouTube playback.
3. Use the prepared description with the November 5 historical Sandbox disclosure and actual source URL.
   Use the final chapters below; remeasure if the replacement changes timing. Do not imply a new on-camera capture.
4. Test the public URL signed out, including audio, 1080p readability, captions and duration.
5. Record the actual video URL and MP4/SRT hashes. Do not attach private raw receipts.

## Devpost — only after explicit authorization

1. Use the reviewed English copy in [DEVPOST_SUBMISSION.md](DEVPOST_SUBMISSION.md); replace every `[YOU]`
   and URL placeholder. Add the public source and Public YouTube links and selected public screenshots.
2. Testing instructions must cover both the no-account simulation and own-account real Sandbox/AI setup.
   If account access needs a disposable judge demo, arrange it privately with narrow access/usage limits;
   never publish privileged provider keys or reusable live authentication secrets.
3. Confirm entrant/team eligibility and original ownership. Choose only award options supported by
   demonstrated integrations; no sponsor-specific tool claim is prepared.
4. Verify rendered links and preview before submitting. Deadline from the
   [official rules](https://paypalaihackathon.devpost.com/rules):
   **November 12, 2026, 12:00 PST / 20:00 UTC / November 13, 05:00 KST**.
5. Submit, save the confirmation, and verify the public project page and all links signed out.
   Preserve working judge access until **December 15, 2026, 08:00 PST**; revoke disposable access afterwards.

Reclassify as **READY WITH DISCLOSED LIMITATIONS** only after the local video gates close. Mark public
repository/video/submission checks complete only after their actual publication is authorized and verified.

## Selected final video

`qa/step7-video/agentpay-guard-demo-final.mp4` / `agentpay-guard-demo-final.srt`.
Technical/continuity QA passes; current audio is not cleared for public distribution.
Follow [AUDIO_REPLACEMENT.md](AUDIO_REPLACEMENT.md) before upload.

0:00 Problem · 0:10 Product · 0:25 Low-risk · 0:52 Human review · 1:09 Approval ·
1:26 Injection block · 1:47 Sandbox payment · 2:09 Webhooks & ledger · 2:32 Close.
