import {
  INJECT_COUNTERS,
  runSsrf,
} from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";

/**
 * Server-Side Request Forgery — archetype B (`engine: "steps"`).
 *
 * The caller chooses a host; the server GETs it. That is a confused
 * deputy: the app can reach a network the browser cannot. Two hosts,
 * two figures. Target 0 is api.example.com, the allowlisted app host.
 * Target 1 is 169.254.169.254, the well-known cloud metadata address.
 *
 * THE CONTROL IS THE TARGET. 0 or 1, default 1. Measured:
 *   open 0: fetched 1 leaked 0, stamp fetched
 *   open 1: fetched 1 leaked 1, result [169.254.169.254], ok false,
 *           stamp metadata
 *   allow 0: fetched 1 leaked 0
 *   allow 1: blocked 1 leaked 0, stamp blocked
 * Seed is ignored: a host check is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Two hosts, no DNS rebinding, no real
 * cloud. 169.254.169.254 is the well-known metadata address; we do not
 * fetch it. An allowlist here is a string compare against
 * api.example.com. Those omissions change how you deploy a URL fetch.
 * They do not change the argument: the server did the GET, and a host
 * check is what stops it.
 */

const OPEN_CODE = [
  "host = parse(url)",
  "GET host",
  "read metadata",
];

const ALLOW_CODE = [
  "host = parse(url)",
  "allowlist check",
  "GET host",
];

const counters = [
  { key: INJECT_COUNTERS.fetched, label: "fetched" },
  { key: INJECT_COUNTERS.leaked, label: "leaked" },
  { key: INJECT_COUNTERS.blocked, label: "blocked" },
];

const sizeControl = {
  label: "target",
  min: 0,
  max: 1,
  default: 1,
} as const;

/** Open fetch: any host the caller named. */
export const ssrfAlgo: AlgoDef<InjectState, number> = {
  id: "ssrf",
  title: "open fetch",
  code: OPEN_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (target) => runSsrf(false, target),
};

/** Same two hosts, against an allowlist of api.example.com. */
export const ssrfAllowAlgo: AlgoDef<InjectState, number> = {
  id: "ssrf-allow",
  title: "allowlist",
  code: ALLOW_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (target) => runSsrf(true, target),
};
