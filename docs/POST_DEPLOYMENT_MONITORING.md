# Post-deployment route monitoring

## Purpose

The repository now includes a deterministic post-deployment monitor for the GitHub Pages application. It checks every public syslab route and verifies the Release D journal and Review-deck markers that must remain present after a deployment.

## Automated schedule

The committed checker is executed by a low-frequency recurring monitoring schedule four times per day. Each run checks the live site and reports route failures in the task’s results. The schedule does not require credentials, a database, or a continuously running server.

## Coverage

The checker probes 30 public routes: the home, About, Learning path, Review deck, and all 26 lesson routes. Each route must return an HTTP 2xx response. It additionally checks the live scaling lesson for the `learning journal`, `Save reflection`, and `Can explain it` markers, and checks the Review route for the practice-deck heading plus `Import` and `Export` journal controls.

The implementation is intentionally deterministic and does not require credentials, accounts, a database, or a third-party monitoring service. A non-2xx response, request failure, missing marker, or timeout exits the process with status 1, causing the scheduled check to report a failure for investigation.

## Local verification

Run the same monitor locally with:

```bash
node scripts/check-live-routes.mjs
```

The target can be overridden for staging or a local static server:

```bash
BASE_URL=http://localhost:4173 node scripts/check-live-routes.mjs
```

The monitor does not mutate the application or learner data. It performs read-only HTTP requests and checks response bodies for expected static markers.
