# Visual QA (advisory)

Screenshot diffing for Replay Club's key public pages. Catches layout / asset /
CSS regressions that backend checks miss — most importantly regressions from the
**SITE_URL flip and DNS cutover**. It is **advisory**: it never blocks a deploy.

- Spec: `key-pages.spec.ts` (chromium, desktop + mobile viewports)
- Workflow: `.github/workflows/visual-qa.yml` (manual `workflow_dispatch`; daily
  `schedule` is present but commented out — opt in when the baseline is stable)
- Canonical URL lives in `src/components/SeoHead.tsx`. At the DNS/SITE_URL flip,
  **re-baseline on purpose** — a domain change legitimately moves canonical/OG
  tags and is not a regression.

## Baselines

Snapshots are environment-specific (font rendering differs per OS/engine), so
**capture the baseline in the same environment that diffs it** — CI (ubuntu).

First time / after an intentional visual change:

1. Run the **Visual QA (advisory)** workflow with `update_baseline = true` and the
   `base_url` you want as truth (defaults to the `VISUAL_QA_BASE_URL` repo var, else
   `https://www.replayclub.io`).
2. Download the `visual-qa-baselines` artifact and commit the snapshots
   (`tests/visual/*-snapshots/`) through the normal push review.
3. Subsequent runs (without `update_baseline`) diff against those and upload a
   `visual-qa-report` artifact with any differences.

## Local capture (optional)

```bash
# boot the app first (Node 24): bun run dev    # http://localhost:8080
PLAYWRIGHT_BASE_URL=http://localhost:8080 \
  bunx playwright test tests/visual --project=chromium-desktop --update-snapshots
```

Locally-captured baselines will differ from CI's — use CI baselines as the source
of truth for the workflow's diffs.

## Tuning

- Add dynamic regions to the `mask` list in `key-pages.spec.ts` if a page is noisy.
- `maxDiffPixelRatio` (default 0.03) trades sensitivity for false positives.
