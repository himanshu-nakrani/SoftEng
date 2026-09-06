import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { InjectChip, InjectKind, InjectState } from "./views/inject";

/**
 * Injection machines for archetype B.
 *
 * SQLi: three users 1, 7, 9. Concatenating `7 OR 1=1` adds operator
 * nodes and matches every row. Binding the same string as a parameter
 * matches nobody.
 *
 * XSS: the name Ada is text. The payload `<script>` is a script node
 * when raw, and a text node when encoded. The figure never executes it.
 *
 * SSRF: `api.example.com` is the allowlisted host. `169.254.169.254` is
 * the cloud metadata address. An open fetch retrieves it; an allowlist
 * refuses.
 *
 * Deliberately absent: a real SQL parser, a browser, DNS rebinding.
 * The argument is that untrusted input became syntax, a script, or a
 * host — counted as chips, not asserted.
 */

export const INJECT_COUNTERS = {
  injected: "injected",
  rows: "rows",
  scripts: "scripts",
  leaked: "leaked",
  blocked: "blocked",
  fetched: "fetched",
} as const;

export const SQL_USERS = ["1", "7", "9"] as const;
export const SQL_PAYLOADS = ["7", "7 OR 1=1"] as const;
export const XSS_PAYLOADS = ["Ada", "<script>"] as const;
export const SSRF_TARGETS = ["api.example.com", "169.254.169.254"] as const;
export const SSRF_ALLOW = "api.example.com";
export const SSRF_METADATA = "169.254.169.254";

function clone(nodes: InjectChip[]): InjectChip[] {
  return nodes.map((n) => ({ ...n }));
}

function node(text: string, role: InjectChip["role"], active = false): InjectChip {
  return { text, role, active };
}

export function runSqli(mode: "concat" | "param", payloadIndex: number): AlgoStep<InjectState>[] {
  const input = SQL_PAYLOADS[payloadIndex] ?? SQL_PAYLOADS[0]!;
  const tautology = mode === "concat" && input.includes("OR");
  let nodes: InjectChip[] = [];
  let result: string[] = [];
  let stamp: string = mode;
  let ok = true;
  const rec = new StepRecorder<InjectState>(() => ({
    kind: "sqli",
    input,
    nodes: clone(nodes),
    result: [...result],
    stamp,
    ok,
  }));

  rec.record({ note: `WHERE id = ${mode === "param" ? "?" : input}.` });

  const prefix = [
    node("SELECT", "kw"),
    node("FROM", "kw"),
    node("users", "id"),
    node("WHERE", "kw"),
    node("id", "id"),
    node("=", "op"),
  ];

  if (mode === "param") {
    nodes = [...prefix, node(input, "lit", true)];
    rec.record({ codeLine: 0, note: `Bind ${input} as a literal.` });
    result = SQL_USERS.filter((id) => id === input).slice();
    rec.bump(INJECT_COUNTERS.rows, result.length);
    stamp = `${result.length} rows`;
    ok = true;
    rec.record({
      codeLine: 1,
      note: result.length === 1 ? `Match id=${result[0]}.` : "No row equals that literal.",
    });
    return rec.steps;
  }

  if (tautology) {
    nodes = [
      ...prefix,
      node("7", "lit"),
      node("OR", "taint", true),
      node("1", "taint"),
      node("=", "taint"),
      node("1", "taint"),
    ];
    rec.bump(INJECT_COUNTERS.injected);
    rec.record({ codeLine: 0, note: "Concat adds OR 1=1 to the AST." });
    result = [...SQL_USERS];
    rec.bump(INJECT_COUNTERS.rows, result.length);
    stamp = "3 rows";
    ok = false;
    rec.record({ codeLine: 1, note: "Tautology matches 1, 7, and 9." });
    return rec.steps;
  }

  nodes = [...prefix, node(input, "lit", true)];
  rec.record({ codeLine: 0, note: `Concat id=${input}.` });
  result = SQL_USERS.filter((id) => id === input).slice();
  rec.bump(INJECT_COUNTERS.rows, result.length);
  stamp = `${result.length} rows`;
  ok = true;
  rec.record({ codeLine: 1, note: `Match id=${result[0] ?? "?"}.` });
  return rec.steps;
}

export function runXss(encode: boolean, payloadIndex: number): AlgoStep<InjectState>[] {
  const input = XSS_PAYLOADS[payloadIndex] ?? XSS_PAYLOADS[0]!;
  const script = input.includes("script");
  let nodes: InjectChip[] = [];
  let result: string[] = [];
  let stamp: string = encode ? "encode" : "raw";
  let ok = true;
  const rec = new StepRecorder<InjectState>(() => ({
    kind: "xss",
    input,
    nodes: clone(nodes),
    result: [...result],
    stamp,
    ok,
  }));

  rec.record({ note: `Hello, ${input}.` });

  if (script && !encode) {
    rec.bump(INJECT_COUNTERS.scripts);
    nodes = [node("Hello,", "text"), node("<script>", "taint", true)];
    result = ["script"];
    stamp = "script";
    ok = false;
    rec.record({ codeLine: 0, note: "Raw payload becomes a script node." });
    return rec.steps;
  }

  const shown = script && encode ? "&lt;script&gt;" : input;
  nodes = [node("Hello,", "text"), node(shown, "lit", true)];
  result = [shown];
  stamp = "text";
  ok = true;
  rec.record({
    codeLine: encode ? 1 : 0,
    note: script ? "Encoded payload stays text." : `Text node ${input}.`,
  });
  return rec.steps;
}

export function runSsrf(allowlist: boolean, targetIndex: number): AlgoStep<InjectState>[] {
  const host = SSRF_TARGETS[targetIndex] ?? SSRF_TARGETS[0]!;
  const metadata = host === SSRF_METADATA;
  let nodes: InjectChip[] = [];
  let result: string[] = [];
  let stamp: string = allowlist ? "allowlist" : "open";
  let ok = true;
  const rec = new StepRecorder<InjectState>(() => ({
    kind: "ssrf",
    input: host,
    nodes: clone(nodes),
    result: [...result],
    stamp,
    ok,
  }));

  rec.record({ note: `Fetch ${host}.` });
  nodes = [node(host, metadata ? "taint" : "host", true)];
  rec.record({ codeLine: 0, note: `Host ${host}.` });

  if (allowlist && host !== SSRF_ALLOW) {
    rec.bump(INJECT_COUNTERS.blocked);
    stamp = "blocked";
    ok = true;
    rec.record({ codeLine: 1, note: "Allowlist refuses that host." });
    return rec.steps;
  }

  rec.bump(INJECT_COUNTERS.fetched);
  result = [host];
  if (metadata) {
    rec.bump(INJECT_COUNTERS.leaked);
    stamp = "metadata";
    ok = false;
    rec.record({ codeLine: 2, note: "Open fetch reads the metadata endpoint." });
  } else {
    stamp = "fetched";
    ok = true;
    rec.record({ codeLine: 1, note: `Fetched ${host}.` });
  }
  return rec.steps;
}

export type InjectInput =
  | { kind: "sqli"; mode: "concat" | "param"; payload: number }
  | { kind: "xss"; encode: boolean; payload: number }
  | { kind: "ssrf"; allowlist: boolean; target: number };

export function runInject(input: InjectInput): AlgoStep<InjectState>[] {
  if (input.kind === "sqli") return runSqli(input.mode, input.payload);
  if (input.kind === "xss") return runXss(input.encode, input.payload);
  return runSsrf(input.allowlist, input.target);
}

export type { InjectKind };
