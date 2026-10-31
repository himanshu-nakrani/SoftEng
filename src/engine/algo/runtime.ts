import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { RuntimeChip, RuntimeLane, RuntimeState } from "./views/runtime";

/**
 * Two evaluators for the same tiny expressions, plus a call stack.
 *
 * Walk: visit every AST node. Bytecode: LOAD / MUL / ADD on a stack.
 * Both yield 7 for 1+2*3. The stack peaks at 3 for that tree, 2 for
 * (1+2)*3.
 *
 * Call stack: f(n) = n==0 ? 1 : n * f(n-1). Cap 4 frames. f(3) returns
 * 6 at depth 4; f(4) overflows.
 *
 * Deliberately absent: locals besides n, closures, a real ISA.
 */

export const RUNTIME_COUNTERS = {
  visits: "visits",
  ops: "ops",
  stack: "stack",
  pushes: "pushes",
  depth: "depth",
  overflow: "overflow",
} as const;

export const EVAL_EXPRS = ["1+2", "1+2*3", "(1+2)*3"] as const;
export const STACK_CAP = 4;

type Ast = { k: "n"; n: number } | { k: "+"; l: Ast; r: Ast } | { k: "*"; l: Ast; r: Ast };

function parseAst(src: string): Ast {
  const t = [...src];
  let i = 0;
  const peek = () => t[i];
  const eat = () => t[i++]!;
  function add(): Ast {
    let left = mul();
    while (peek() === "+") {
      eat();
      left = { k: "+", l: left, r: mul() };
    }
    return left;
  }
  function mul(): Ast {
    let left = atom();
    while (peek() === "*") {
      eat();
      left = { k: "*", l: left, r: atom() };
    }
    return left;
  }
  function atom(): Ast {
    if (peek() === "(") {
      eat();
      const inner = add();
      eat();
      return inner;
    }
    return { k: "n", n: Number(eat()) };
  }
  return add();
}

function clone(lanes: RuntimeLane[]): RuntimeLane[] {
  return lanes.map((l) => ({
    name: l.name,
    chips: l.chips.map((c) => ({ ...c })),
  }));
}

function chip(label: string, value?: string, active = false, tone: RuntimeChip["tone"] = "idle"): RuntimeChip {
  return { label, value, active, tone };
}

export function runWalk(exprIndex: number): AlgoStep<RuntimeState>[] {
  const source = EVAL_EXPRS[exprIndex] ?? EVAL_EXPRS[0]!;
  const ast = parseAst(source);
  let lanes: RuntimeLane[] = [];
  let stamp: string = "walk";
  let result: number | null = null;
  const rec = new StepRecorder<RuntimeState>(() => ({
    kind: "walk",
    lanes: clone(lanes),
    stamp,
    result,
  }));

  rec.record({ note: `Walk ${source}.` });

  function walk(node: Ast): number {
    rec.bump(RUNTIME_COUNTERS.visits);
    if (node.k === "n") {
      lanes = [{ name: "visit", chips: [chip("n", String(node.n), true, "ok")] }];
      rec.record({ codeLine: 0, note: `Leaf ${node.n}.` });
      return node.n;
    }
    const l = walk(node.l);
    const r = walk(node.r);
    const v = node.k === "+" ? l + r : l * r;
    lanes = [
      {
        name: "visit",
        chips: [
          chip(node.k, String(v), true, "ok"),
          chip("l", String(l)),
          chip("r", String(r)),
        ],
      },
    ];
    rec.record({ codeLine: 1, note: `${l} ${node.k} ${r} = ${v}.` });
    return v;
  }

  result = walk(ast);
  stamp = String(result);
  rec.record({ note: `${source} = ${result}.` });
  return rec.steps;
}

export function runBytecode(exprIndex: number): AlgoStep<RuntimeState>[] {
  const source = EVAL_EXPRS[exprIndex] ?? EVAL_EXPRS[0]!;
  const ast = parseAst(source);
  const code: string[] = [];
  function compile(node: Ast): void {
    if (node.k === "n") code.push(`LOAD ${node.n}`);
    else {
      compile(node.l);
      compile(node.r);
      code.push(node.k === "+" ? "ADD" : "MUL");
    }
  }
  compile(ast);

  const stack: number[] = [];
  let max = 0;
  let ip = 0;
  let lanes: RuntimeLane[] = [];
  let stamp: string = "bytecode";
  let result: number | null = null;
  const rec = new StepRecorder<RuntimeState>(() => ({
    kind: "bytecode",
    lanes: clone(lanes),
    stamp,
    result,
  }));

  rec.record({ note: `Compile ${source} → ${code.length} ops.` });
  lanes = [{ name: "code", chips: code.map((c) => chip(c)) }];
  rec.record({ codeLine: 0, note: code.join(", ") + "." });

  for (const op of code) {
    ip += 1;
    if (op.startsWith("LOAD")) stack.push(Number(op.slice(5)));
    else {
      const b = stack.pop() ?? 0;
      const a = stack.pop() ?? 0;
      stack.push(op === "ADD" ? a + b : a * b);
    }
    if (stack.length > max) {
      rec.bump(RUNTIME_COUNTERS.stack, stack.length - max);
      max = stack.length;
    }
    rec.bump(RUNTIME_COUNTERS.ops);
    lanes = [
      {
        name: "code",
        chips: code.map((c, i) => chip(c, undefined, i === ip - 1)),
      },
      {
        name: "stack",
        chips: stack.map((n, i) => chip(String(n), undefined, i === stack.length - 1, "ok")),
      },
    ];
    rec.record({ codeLine: 1, note: `${op}. stack [${stack.join(" ")}].` });
  }

  result = stack[0] ?? 0;
  stamp = String(result);
  rec.record({ note: `${source} = ${result}. stack max ${max}.` });
  return rec.steps;
}

export function runCallStack(n: number): AlgoStep<RuntimeState>[] {
  const frames: { k: number }[] = [];
  let max = 0;
  let lanes: RuntimeLane[] = [];
  let stamp: string = "stack";
  let result: number | null = null;
  let overflow = false;
  const rec = new StepRecorder<RuntimeState>(() => ({
    kind: "stack",
    lanes: clone(lanes),
    stamp,
    result,
    overflow,
  }));

  function show(active: number | null): void {
    lanes = [
      {
        name: "frames",
        chips: frames.map((f) =>
          chip(`f(${f.k})`, undefined, f.k === active, overflow ? "bad" : "ok"),
        ),
      },
    ];
  }

  rec.record({ note: `f(${n}). cap ${STACK_CAP}.` });

  function f(k: number): number | null {
    if (frames.length >= STACK_CAP) {
      rec.bump(RUNTIME_COUNTERS.overflow);
      overflow = true;
      stamp = "overflow";
      show(k);
      rec.record({ codeLine: 3, note: `Overflow at f(${k}). cap ${STACK_CAP}.` });
      return null;
    }
    rec.bump(RUNTIME_COUNTERS.pushes);
    frames.push({ k });
    if (frames.length > max) {
      rec.bump(RUNTIME_COUNTERS.depth, frames.length - max);
      max = frames.length;
    }
    show(k);
    rec.record({ codeLine: 0, note: `Enter f(${k}). depth ${frames.length}.` });

    let v: number | null;
    if (k === 0) {
      v = 1;
      rec.record({ codeLine: 1, note: "f(0) = 1." });
    } else {
      const inner = f(k - 1);
      v = inner === null ? null : k * inner;
    }
    frames.pop();
    show(null);
    rec.record({
      codeLine: 2,
      note: v === null ? `Unwind f(${k}).` : `Return f(${k})=${v}.`,
    });
    return v;
  }

  result = f(n);
  if (!overflow) {
    stamp = String(result);
    rec.record({ note: `f(${n}) = ${result}. depth ${max}.` });
  }
  return rec.steps;
}

