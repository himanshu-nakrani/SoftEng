# Post-deployment route monitoring

## Purpose

`ci.yml` proves the static export builds and behaves. It says nothing about what
GitHub Pages is actually serving — a bad base path, a failed deploy, or a stale
cache all pass CI and break the site. This monitor is the only thing that checks
the deployed origin.

## Automated schedule

`.github/workflows/monitor.yml` runs it four times a day (`cron: "10 */6 * * *"`),
and on demand via **workflow_dispatch** with an optional `base_url` input for
checking a staging origin. No credentials, database, or long-running server.

> Note for anyone reading git history: this document described a four-times-daily
> schedule for some time before any workflow existed. It exists now, and the route
> list is no longer hand-maintained — see below.

## Coverage

The route list is **derived from the curriculum registry**, so shipping a lesson
extends the monitor for free. It previously listed thirty paths by hand, and had
gone stale by fourteen lessons plus `/playground` — reporting green while checking
a third less than it claimed.

Each run currently probes **74 routes**:

- the non-curriculum surfaces: `/`, `/about`, `/learn`, `/review`, `/playground`;
- every track landing (`/learn/<track>`);
- every `status: "available"` lesson route;
- the pre-migration `/learn/<module>/<slug>` URLs for track 01, because those
  redirect stubs are a promise to anyone holding an old link.

Every route must return 2xx. Beyond status codes it checks **content markers** —
strings that would disappear if the feature behind them broke, since a 200 only
proves bytes were served:

| Route | Markers |
|---|---|
| `scaling-strategies` | `learning journal`, `Save reflection`, `Can explain it` |
| `/review` | `Every prediction, in one deck`, `Import`, `Export` |
| `data-races` | `counter++`, `read counter` |

The third exists so a break in the discrete-step engine's page rendering is caught
as well as the packet engine's.

A non-2xx response, request failure, missing marker, or timeout exits 1 and prints
a summary of every failed check, so the workflow reports a failure to investigate.

## Local verification

```bash
npm run monitor:routes                                   # the deployed site
BASE_URL=http://localhost:4173 npm run monitor:routes    # a local static server
```

For a local run, build first (`npm run build`) and serve `out/`. The monitor is
read-only: HTTP GETs and string checks against response bodies. It never mutates
the application or learner data.
