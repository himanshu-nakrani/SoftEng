# syslab Release D Report

**Release:** v0.4.0
**Project:** [himanshu-nakrani/SoftEng](https://github.com/himanshu-nakrani/SoftEng)
**Deployment:** [GitHub Pages site](https://himanshu-nakrani.github.io/SoftEng/)
**Release date:** 15 August 2026
**Release status:** Successful and deployed

## Executive summary

Release D completes syslab’s local-first Learning Journal and confidence-aware Review deck. Learners can write a bounded reflection for each lesson, record whether they are uncertain, getting it, or able to explain the idea, and keep the information privately in browser localStorage without an account or backend. The Review deck uses that confidence signal only to prioritize practice; it does not alter recorded quiz results or turn practice answers into assessment data.

The release was implemented as a reviewed stacked pull-request series, promoted into `main`, built as a static export, deployed to GitHub Pages, and validated after deployment. The final main branch is `0f8202d62d3644d54152c0cc7d71e45d64e2e053`. The final GitHub Actions workflow completed successfully, and the live application passed a 30-route HTTP probe plus direct browser checks of the journal persistence and Review-deck controls.

## Release scope

| Area | Delivered behavior |
|---|---|
| Local-first journal | Zustand store persisted as `softeng-journal` in browser localStorage; no accounts, server, or remote learner-data service |
| Reflection capture | Per-lesson textarea with a 480-character bound, local privacy copy, and visible save confirmation |
| Confidence calibration | `uncertain`, `getting-it`, and `can-explain` states stored per lesson |
| Review prioritization | Existing practice tiers remain primary; lower-confidence lessons rise within each tier |
| Practice integrity | Confidence and journal data do not modify recorded quiz results; Review remains practice-only |
| Journal portability | JSON export/import with sanitization and timestamp-safe merging |
| Accessibility | Keyboard-reachable confidence controls, labeled textarea, live save status, and preserved prior modal/focus behavior |
| Deployment | Static export remains compatible with the `/SoftEng` GitHub Pages base path |
| Monitoring | Scheduled read-only route monitor checks all 30 public routes and key Release D markers |

## Pull-request history

Release D was deliberately reviewed in layers. PR #5 established the journal contracts and lesson UI. PR #6 added the Review-deck behavior and journal tools on top of PR #5. Because PR #6 was merged into the stack branch rather than directly into `main`, PR #7 promoted the already-reviewed complete stack into `main` and triggered the final deployment.

| PR | Title | Base → head | Merge status | Link |
|---|---|---|---|---|
| #5 | `feat: add local learning journal foundation` | `main` → `feat/release-d-journal-base` | Merged | [View PR #5](https://github.com/himanshu-nakrani/SoftEng/pull/5) |
| #6 | `feat: add confidence-aware review deck` | `feat/release-d-journal-base` → `feat/release-d-review-stack` | Merged into stack base | [View PR #6](https://github.com/himanshu-nakrani/SoftEng/pull/6) |
| #7 | `release: promote complete Release D` | `main` → `feat/release-d-journal-base` | Merged into `main` | [View PR #7](https://github.com/himanshu-nakrani/SoftEng/pull/7) |

All component PRs passed repository CI, Greptile Review, and Kilo Code Review before merge. The final promotion PR contained the already-reviewed Release D stack and was used only to move the complete result into the deployment branch.

## Validation metrics

The release was validated at three levels: repository correctness, browser behavior, and live deployment health.

| Validation | Result | Coverage |
|---|---:|---|
| `npm run check` | Passed | TypeScript, ESLint, curriculum registry, and 258 Vitest tests |
| `npm run build` | Passed | Next.js static export; all expected application and metadata routes generated |
| Full Playwright run | **110 passed** | Smoke, WCAG accessibility, mobile layout/touch targets, interaction flows, and visual determinism |
| Visual suite | **30 passed** | 26 lesson stages plus four deterministic visualization snapshots |
| Accessibility suite | Passed | Hub, Review, and all lesson routes scanned for WCAG A/AA violations |
| Interaction suite | Passed | Simulation controls, checkpoints, themes, personalization, journal persistence/export, Review practice, and import/reset flows |
| Live HTTP monitoring probe | **30/30 passed** | Home, About, Learning path, Review, and all 26 lesson routes returned HTTP 200 |
| Live content markers | Passed | Journal and Review import/export controls found in deployed HTML |
| Post-deployment browser check | Passed | Reflection, confidence, local save, reload persistence, and Review controls verified |

The final local deep-validation run also confirmed that a real input/change event persisted both the journal note and `can-explain` confidence in `softeng-journal`, and that a subsequent route reload restored both values. A resource-name heuristic initially surfaced a JavaScript filename containing the digits `404`; a direct fetch returned HTTP 200, confirming that it was not a missing resource.

## Deployment evidence

The final deployment was produced by [GitHub Actions run 31877002642](https://github.com/himanshu-nakrani/SoftEng/actions/runs/31877002642). Its check/build/smoke-test job and GitHub Pages deployment job both completed successfully. The live validation targets are the [scaling lesson](https://himanshu-nakrani.github.io/SoftEng/learn/scaling/scaling-strategies) and the [Review deck](https://himanshu-nakrani.github.io/SoftEng/review).

> The deployed release is a static GitHub Pages application. Learner reflections remain in each browser’s localStorage and are never uploaded by the Release D feature.

## Automated post-deployment monitoring

The release adds the committed `scripts/check-live-routes.mjs` checker and a low-frequency recurring monitoring schedule that runs four times per day. Each run performs read-only checks against all 30 public routes and verifies the journal and Review markers. A request failure, non-2xx response, timeout, or missing marker causes the scheduled check to report a failure for investigation.

The monitor was run locally against the live site before release preparation and returned zero failed checks. Full maintainer instructions are in [`docs/POST_DEPLOYMENT_MONITORING.md`](https://github.com/himanshu-nakrani/SoftEng/blob/main/docs/POST_DEPLOYMENT_MONITORING.md).

## Git release state

The successful release is tagged as **`v0.4.0`** with an annotated Git tag on the final `main` commit. Local development branches used for the stacked PRs were removed after merge; the remote release history remains available through the merged PRs and GitHub commit history. Pre-existing untracked research notes, design studies, generated theme images, and unrelated working artifacts were not included in the release commit.

## Known operational notes

The monitor is intentionally deterministic and read-only. It detects route availability and expected static markers but does not measure browser performance, accessibility scores, JavaScript runtime exceptions, or end-user geography. Those concerns remain covered by the repository’s CI and browser suites. If future requirements include alert delivery to email, Slack, or another external channel, that should be added as a separate integration with explicit credentials and notification ownership.

## References

[1]: https://github.com/himanshu-nakrani/SoftEng "syslab GitHub repository"
[2]: https://github.com/himanshu-nakrani/SoftEng/pull/5 "PR #5 — local learning journal foundation"
[3]: https://github.com/himanshu-nakrani/SoftEng/pull/6 "PR #6 — confidence-aware Review deck"
[4]: https://github.com/himanshu-nakrani/SoftEng/pull/7 "PR #7 — promote complete Release D"
[5]: https://github.com/himanshu-nakrani/SoftEng/actions/runs/31877002642 "Final Release D CI and GitHub Pages deployment run"
[6]: https://himanshu-nakrani.github.io/SoftEng/learn/scaling/scaling-strategies "Live scaling lesson"
[7]: https://himanshu-nakrani.github.io/SoftEng/review "Live Review deck"
