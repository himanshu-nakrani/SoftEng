import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  RefactorFn,
  RefactorLine,
  RefactorNodeKind,
  RefactorState,
} from "./views/refactor";

/**
 * Refactor workbench — a step producer for archetype B, over `RefactorState`.
 *
 * The seventh thing to ride the discrete-step engine, and the first whose
 * subject is CODE being restructured rather than a data structure being mutated.
 * A refactoring is a finite sequence of states — the module before, then after
 * each transform — so it is a state contract + producer + view + test file, not
 * new machinery (the rule in CLAUDE.md, applied again).
 *
 * WHY THIS PRODUCER EXISTS, AND THE HONESTY IT REQUIRES. A refactoring lesson is
 * worthless if its "complexity fell from 7 to 2" is a number the author typed.
 * The F spike (`scripts/spike-f-refactor.mts`) settled this before any lesson
 * was built: cyclomatic complexity and fan-out are computed HERE, by folding
 * over the toy AST, so a transform that moves the structure moves the metric as
 * a consequence. The invariant that proves it: a pure Extract Function CONSERVES
 * total decision points — it relocates them, it does not invent or destroy them
 * — which `refactor.test.ts` asserts on every step. If a metric could be
 * hand-authored, that conservation law could not hold across an extraction.
 *
 * WHAT IS MODELLED, AND WHAT IS NOT. The AST is a toy (see `views/refactor.ts`):
 * enough control-flow node kinds to define McCabe complexity honestly, no more.
 * There are no expressions, types, or name resolution, so the transforms here
 * (Extract Function, Inline Function, Rename) are STRUCTURAL rewrites of the node
 * list, not semantics-preserving compiler passes — the lesson is what the
 * restructuring does to a metric, and a real grammar would obscure that rather
 * than sharpen it. This producer takes no RNG: a refactoring script is a fixed
 * sequence, exactly like a WAL script or a repo script — git is not random and
 * neither is a planned refactor.
 */

/* ------------------------------------------------------------------ *
 * The toy AST
 * ------------------------------------------------------------------ */

/**
 * One statement node. A `block` carries a nested body, so complexity counting is
 * a recursive fold; a `call` carries the callee, so fan-out is a set union.
 */
export type AstNode =
  | { kind: "branch"; text: string; body: AstNode[] }
  | { kind: "loop"; text: string; body: AstNode[] }
  | { kind: "and"; text: string }
  | { kind: "or"; text: string }
  | { kind: "case"; text: string; body: AstNode[] }
  | { kind: "call"; text: string; callee: string }
  | { kind: "plain"; text: string };

export interface AstFn {
  name: string;
  body: AstNode[];
}

export interface RefactorModule {
  fns: AstFn[];
}

/* ------------------------------------------------------------------ *
 * Real metrics, folded over the AST — the honesty of the whole thing
 * ------------------------------------------------------------------ */

/**
 * McCabe cyclomatic complexity: 1 + the number of decision points. A decision
 * point is a branch, a loop, a boolean `&&`/`||`, or a switch arm — every place
 * control can go two ways. Computed by folding over the node list, so it is a
 * PROPERTY of the structure, never a stored number.
 */
export function cyclomatic(fn: AstFn): number {
  let decisions = 0;
  const walk = (nodes: AstNode[]): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case "branch":
        case "loop":
          decisions += 1;
          walk(node.body);
          break;
        case "case":
          decisions += 1;
          walk(node.body);
          break;
        case "and":
        case "or":
          decisions += 1;
          break;
        default:
          break;
      }
    }
  };
  walk(fn.body);
  return 1 + decisions;
}

/** Fan-out (coupling): the number of DISTINCT functions this one calls. */
export function fanOut(fn: AstFn): number {
  const callees = new Set<string>();
  const walk = (nodes: AstNode[]): void => {
    for (const node of nodes) {
      if (node.kind === "call") callees.add(node.callee);
      else if (node.kind === "branch" || node.kind === "loop" || node.kind === "case") {
        walk(node.body);
      }
    }
  };
  walk(fn.body);
  return callees.size;
}

/** Total decision points across the module — conserved by a pure extraction. */
function totalDecisions(module: RefactorModule): number {
  return module.fns.reduce((sum, fn) => sum + (cyclomatic(fn) - 1), 0);
}

/**
 * Duplication: the number of call sites of functions that are called from more
 * than one place. A block extracted once and then called from N sites collapses
 * N copies into N calls, so the honest thing to count as "still duplicated" is
 * inlined blocks that recur — which in this toy is modelled as functions whose
 * body appears verbatim inside more than one caller (an `inline` marker). We
 * count the surplus copies: a block present in K callers contributes K − 1.
 */
function duplication(module: RefactorModule): number {
  const signatures = new Map<string, number>();
  for (const fn of module.fns) {
    for (const node of fn.body) {
      if (node.kind === "branch" && node.body.length > 0) {
        const sig = signature(node);
        signatures.set(sig, (signatures.get(sig) ?? 0) + 1);
      }
    }
  }
  let surplus = 0;
  for (const count of signatures.values()) if (count > 1) surplus += count - 1;
  return surplus;
}

/** A structural signature of a node subtree, for duplicate detection. */
function signature(node: AstNode): string {
  if (node.kind === "branch" || node.kind === "loop" || node.kind === "case") {
    return `${node.kind}(${node.text})[${node.body.map(signature).join(",")}]`;
  }
  if (node.kind === "call") return `call(${node.callee})`;
  return `${node.kind}(${node.text})`;
}

/* ------------------------------------------------------------------ *
 * Transforms — structural rewrites of the node list
 * ------------------------------------------------------------------ */

/**
 * A step of a refactoring script: a transform plus the function it targets.
 * Structural, deterministic, no RNG.
 */
export type Transform =
  | {
      kind: "extract";
      /** Function to extract FROM. */
      from: string;
      /** Half-open range of statements [start, end) to lift out. */
      start: number;
      end: number;
      /** Name of the new function. */
      into: string;
      /** Optional transform label override (e.g. "Extract Class"). */
      label?: string;
      /** Optional note override for this step. */
      note?: string;
    }
  | {
      kind: "inline";
      /** Function whose single call of `callee` is replaced by its body. */
      caller: string;
      callee: string;
    }
  | {
      kind: "dedupe";
      /**
       * Replace the statements [start, end) of `from` with a call to an
       * EXISTING function `into` — the second half of removing duplication, once
       * the shared block already lives in `into`. This is what actually collapses
       * two copies into one: an ordinary extract makes a new function each time,
       * a dedupe reuses the one that is already there.
       */
      from: string;
      start: number;
      end: number;
      into: string;
    }
  | { kind: "rename"; from: string; to: string }
  | {
      kind: "polymorph";
      /** The dispatcher function being refactored. */
      from: string;
      /** Name of the polymorphic handler / subclass method. */
      handler: string;
      /** The handler's straight-line body (cc = 1). */
      body: AstNode[];
      /** The updated body of the dispatcher after shedding this conditional branch. */
      updatedDispatcherBody: AstNode[];
      label?: string;
      note?: string;
    }
  | {
      kind: "add-strategy";
      name: string;
      body: AstNode[];
      label?: string;
      note?: string;
    };

export interface RefactorScript {
  module: RefactorModule;
  /** The label shown before any transform runs. */
  title: string;
  steps: Transform[];
}

/** Deep-clone a module so a frame never aliases the working AST. */
function cloneModule(module: RefactorModule): RefactorModule {
  return { fns: module.fns.map((fn) => ({ name: fn.name, body: cloneNodes(fn.body) })) };
}
function cloneNodes(nodes: AstNode[]): AstNode[] {
  return nodes.map((node) => {
    if (node.kind === "branch" || node.kind === "loop" || node.kind === "case") {
      return { ...node, body: cloneNodes(node.body) };
    }
    return { ...node };
  });
}

function applyExtract(
  module: RefactorModule,
  t: Extract<Transform, { kind: "extract" }>,
): { module: RefactorModule; changed: Set<string>; created: string } {
  const src = module.fns.find((f) => f.name === t.from)!;
  const lifted = src.body.slice(t.start, t.end);
  const callNode: AstNode = { kind: "call", text: `${t.into}()`, callee: t.into };
  const rewritten: AstFn = {
    name: src.name,
    body: [...src.body.slice(0, t.start), callNode, ...src.body.slice(t.end)],
  };
  const fns = module.fns.map((f) => (f.name === t.from ? rewritten : f));
  fns.push({ name: t.into, body: lifted });
  return { module: { fns }, changed: new Set([t.from]), created: t.into };
}

function applyDedupe(
  module: RefactorModule,
  t: Extract<Transform, { kind: "dedupe" }>,
): { module: RefactorModule; changed: Set<string> } {
  const callNode: AstNode = { kind: "call", text: `${t.into}()`, callee: t.into };
  const fns = module.fns.map((f) =>
    f.name === t.from
      ? { name: f.name, body: [...f.body.slice(0, t.start), callNode, ...f.body.slice(t.end)] }
      : f,
  );
  return { module: { fns }, changed: new Set([t.from]) };
}

function applyInline(
  module: RefactorModule,
  t: Extract<Transform, { kind: "inline" }>,
): { module: RefactorModule; changed: Set<string> } {
  const callee = module.fns.find((f) => f.name === t.callee)!;
  const fns: AstFn[] = [];
  for (const fn of module.fns) {
    if (fn.name === t.callee) continue; // the callee disappears when inlined away
    if (fn.name === t.caller) {
      const body: AstNode[] = [];
      for (const node of fn.body) {
        if (node.kind === "call" && node.callee === t.callee) {
          body.push(...cloneNodes(callee.body));
        } else {
          body.push(node);
        }
      }
      fns.push({ name: fn.name, body });
    } else {
      fns.push(fn);
    }
  }
  return { module: { fns }, changed: new Set([t.caller]) };
}

function applyRename(
  module: RefactorModule,
  t: Extract<Transform, { kind: "rename" }>,
): { module: RefactorModule; changed: Set<string> } {
  const changed = new Set<string>();
  const fns = module.fns.map((fn) => {
    const body = renameCalls(fn.body, t.from, t.to, () => changed.add(fn.name));
    const name = fn.name === t.from ? t.to : fn.name;
    if (name !== fn.name) changed.add(name);
    return { name, body };
  });
  return { module: { fns }, changed };
}
function renameCalls(nodes: AstNode[], from: string, to: string, mark: () => void): AstNode[] {
  return nodes.map((node) => {
    if (node.kind === "call" && node.callee === from) {
      mark();
      return { kind: "call", text: `${to}()`, callee: to };
    }
    if (node.kind === "branch" || node.kind === "loop" || node.kind === "case") {
      return { ...node, body: renameCalls(node.body, from, to, mark) };
    }
    return node;
  });
}

/* ------------------------------------------------------------------ *
 * Counters
 * ------------------------------------------------------------------ */

export const REFACTOR_COUNTERS = {
  /** Transforms applied. */
  transforms: "transforms",
  /** Functions created by extraction. */
  extracted: "extracted",
  /** Polymorphic handlers created. */
  polymorphicHandlers: "polymorphicHandlers",
} as const;

/* ------------------------------------------------------------------ *
 * Frame rendering
 * ------------------------------------------------------------------ */

/** Flatten a function's AST into the flat, depth-tagged line list a view draws. */
function toLines(nodes: AstNode[], depth: number, touched: Set<string>): RefactorLine[] {
  const lines: RefactorLine[] = [];
  for (const node of nodes) {
    const kind: RefactorNodeKind = node.kind;
    const line: RefactorLine = {
      depth,
      text: node.text,
      kind,
      touched: touched.has(node.text),
    };
    if (node.kind === "call") line.callee = node.callee;
    lines.push(line);
    if (node.kind === "branch" || node.kind === "loop" || node.kind === "case") {
      lines.push(...toLines(node.body, depth + 1, touched));
    }
  }
  return lines;
}

function frameFor(
  module: RefactorModule,
  activeFn: string | null,
  changed: Set<string>,
  newFns: Set<string>,
  transform: string | undefined,
  note: string | undefined,
  touchedText: Set<string>,
): RefactorState {
  const fns: RefactorFn[] = module.fns.map((fn) => ({
    name: fn.name,
    lines: toLines(fn.body, 0, touchedText),
    complexity: cyclomatic(fn),
    fanOut: fanOut(fn),
    changed: changed.has(fn.name),
    isNew: newFns.has(fn.name),
  }));
  return {
    fns,
    activeFn,
    metrics: {
      maxComplexity: Math.max(...fns.map((f) => f.complexity)),
      totalDecisions: totalDecisions(module),
      maxFanOut: Math.max(...fns.map((f) => f.fanOut)),
      duplication: duplication(module),
    },
    transform,
    note,
  };
}

/* ------------------------------------------------------------------ *
 * The producer
 * ------------------------------------------------------------------ */

/**
 * Run a refactoring script, one frame per transform (plus the untouched first
 * frame). Every frame recomputes the metrics from the AST, so the numbers the
 * view draws are folded over the tree, never stored.
 */
export function runRefactor(script: RefactorScript): AlgoStep<RefactorState>[] {
  let working = cloneModule(script.module);
  const newFns = new Set<string>();

  let snapshot = frameFor(
    working,
    hottest(working),
    new Set(),
    newFns,
    undefined,
    `${script.title} — hot spot: ${hotName(working)} at complexity ${maxCc(working)}`,
    new Set(),
  );

  const rec = new StepRecorder<RefactorState>(() => snapshot);
  rec.record({ note: snapshot.note });

  script.steps.forEach((step) => {
    let changed = new Set<string>();
    let activeFn: string | null = null;
    let transformLabel = "";
    let note = "";
    const touchedText = new Set<string>();

    if (step.kind === "extract") {
      // Remember the text of the lifted lines so the view can highlight them.
      const src = working.fns.find((f) => f.name === step.from)!;
      for (const node of src.body.slice(step.start, step.end)) touchedText.add(node.text);
      const result = applyExtract(working, step);
      working = result.module;
      changed = result.changed;
      changed.add(result.created);
      newFns.add(result.created);
      activeFn = result.created;
      transformLabel = step.label ?? "Extract Function";
      rec.bump(REFACTOR_COUNTERS.extracted);
      note =
        step.note ??
        `Extract ${step.into} from ${step.from}: ${step.from} sheds decision points, a new function gains them`;
    } else if (step.kind === "dedupe") {
      const src = working.fns.find((f) => f.name === step.from)!;
      for (const node of src.body.slice(step.start, step.end)) touchedText.add(node.text);
      const result = applyDedupe(working, step);
      working = result.module;
      changed = result.changed;
      activeFn = step.from;
      transformLabel = "Reuse Function";
      note = `Replace the duplicated block in ${step.from} with a call to ${step.into}: two copies collapse into one`;
    } else if (step.kind === "inline") {
      const result = applyInline(working, step);
      working = result.module;
      changed = result.changed;
      activeFn = step.caller;
      transformLabel = "Inline Function";
      note = `Inline ${step.callee} into ${step.caller}: one call becomes the body, ${step.callee} disappears`;
    } else if (step.kind === "rename") {
      const result = applyRename(working, step);
      working = result.module;
      changed = result.changed;
      activeFn = step.to;
      transformLabel = "Rename";
      note = `Rename ${step.from} to ${step.to}: every call site updated`;
    } else if (step.kind === "polymorph") {
      const srcIndex = working.fns.findIndex((f) => f.name === step.from);
      if (srcIndex !== -1) {
        working.fns[srcIndex] = {
          name: step.from,
          body: cloneNodes(step.updatedDispatcherBody),
        };
      }
      working.fns.push({
        name: step.handler,
        body: cloneNodes(step.body),
      });
      changed = new Set([step.from, step.handler]);
      newFns.add(step.handler);
      activeFn = step.handler;
      transformLabel = step.label ?? "Polymorphic Handler";
      rec.bump(REFACTOR_COUNTERS.extracted);
      rec.bump(REFACTOR_COUNTERS.polymorphicHandlers);
      note =
        step.note ??
        `Extract ${step.handler} strategy (cc 1): ${step.from} sheds branch, complexity falls`;
      for (const node of step.body) touchedText.add(node.text);
      for (const node of step.updatedDispatcherBody) touchedText.add(node.text);
    } else if (step.kind === "add-strategy") {
      working.fns.push({
        name: step.name,
        body: cloneNodes(step.body),
      });
      changed = new Set([step.name]);
      newFns.add(step.name);
      activeFn = step.name;
      transformLabel = step.label ?? "Add Strategy (OCP)";
      rec.bump(REFACTOR_COUNTERS.extracted);
      rec.bump(REFACTOR_COUNTERS.polymorphicHandlers);
      note =
        step.note ??
        `Add new strategy ${step.name} (cc 1): dispatcher and existing handlers untouched`;
      for (const node of step.body) touchedText.add(node.text);
    }

    rec.bump(REFACTOR_COUNTERS.transforms);
    snapshot = frameFor(working, activeFn, changed, newFns, transformLabel, note, touchedText);
    rec.record({ note });
  });

  return rec.steps;
}

/* ------------------------------------------------------------------ *
 * Small helpers used only for the opening frame's banner
 * ------------------------------------------------------------------ */

function maxCc(module: RefactorModule): number {
  return Math.max(...module.fns.map(cyclomatic));
}
function hottest(module: RefactorModule): string {
  return hotName(module);
}
function hotName(module: RefactorModule): string {
  let best = module.fns[0];
  for (const fn of module.fns) if (cyclomatic(fn) > cyclomatic(best)) best = fn;
  return best.name;
}
