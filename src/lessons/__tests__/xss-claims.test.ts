import { buildAlgoSteps } from "@/engine/algo/build";
import {
  INJECT_COUNTERS as C,
  XSS_PAYLOADS,
  runXss,
} from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";
import {
  xssAlgo,
  xssEncodeAlgo,
} from "@/lessons/application-security/xss";
import { describe, expect, it } from "vitest";

/**
 * The xss prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 *
 * Both figures drive `runXss` with the payload index as the SIZE
 * argument. Seed is ignored: a greeting is not a scheduler.
 */

function at(def: AlgoDef<InjectState, number>, payload: number, seed = 42) {
  const steps = buildAlgoSteps(def, payload, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    scripts: last.counters[C.scripts] ?? 0,
    stamp: last.state.stamp,
    ok: last.state.ok,
    note: last.note,
    result: last.state.result,
    input: last.state.input,
  };
}

describe("xss · the slider is the payload, 0 or 1", () => {
  it("offers 0 through 1, default 1, labelled payload", () => {
    // "The slider is the payload, 0 or 1. Default 1 is the string
    // <script>. Payload 0 is Ada."
    expect(xssAlgo.id).toBe("xss");
    expect(xssEncodeAlgo.id).toBe("xss-encode");
    expect(xssAlgo.size).toMatchObject({
      min: 0,
      max: 1,
      default: 1,
      label: "payload",
    });
    expect(xssEncodeAlgo.size).toEqual(xssAlgo.size);
    expect(xssAlgo.counters.map((c) => c.key)).toEqual([C.scripts]);
    expect(XSS_PAYLOADS).toEqual(["Ada", "<script>"]);
  });

  it("ignores the seed: a greeting is not a scheduler", () => {
    expect(buildAlgoSteps(xssAlgo, 1, 1)).toEqual(
      buildAlgoSteps(xssAlgo, 1, 99),
    );
    expect(buildAlgoSteps(xssEncodeAlgo, 1, 1)).toEqual(
      buildAlgoSteps(xssEncodeAlgo, 1, 99),
    );
  });

  it("the producer and the lesson defs agree at both payloads", () => {
    for (const p of [0, 1] as const) {
      expect(buildAlgoSteps(xssAlgo, p, 42)).toEqual(runXss(false, p));
      expect(buildAlgoSteps(xssEncodeAlgo, p, 42)).toEqual(runXss(true, p));
    }
  });
});

describe("xss · payload 0 is Ada, text, both figures", () => {
  it("raw 0: Ada, scripts 0, stamp text", () => {
    // "Drag to 0. Ada is a text node. scripts is 0. The stamp reads text."
    // "Payload 0 is Ada, text, both figures."
    const run = at(xssAlgo, 0);
    expect(run.input).toBe("Ada");
    expect(run.scripts).toBe(0);
    expect(run.stamp).toBe("text");
    expect(run.ok).toBe(true);
    expect(run.result).toEqual(["Ada"]);
    expect(run.steps[0]!.note).toBe("Hello, Ada.");
    expect(run.note).toBe("Text node Ada.");
  });

  it("encode 0: Ada, scripts 0, stamp text", () => {
    // "Ada is a text node either way (scripts 0)."
    const run = at(xssEncodeAlgo, 0);
    expect(run.input).toBe("Ada");
    expect(run.scripts).toBe(0);
    expect(run.stamp).toBe("text");
    expect(run.ok).toBe(true);
    expect(run.result).toEqual(["Ada"]);
    expect(run.steps[0]!.note).toBe("Hello, Ada.");
    expect(run.note).toBe("Text node Ada.");
  });
});

describe("xss · raw payload 1 becomes a script node", () => {
  it("raw 1: scripts 1, ok false, stamp script", () => {
    // "Leave payload at 1. The first caption is \"Hello, <script>.\""
    // "Step. scripts is 1. The stamp reads script. The last caption:
    // \"Raw payload becomes a script node.\""
    // "Raw <script> becomes a script node (scripts 1)."
    const run = at(xssAlgo, 1);
    expect(run.input).toBe("<script>");
    expect(run.steps[0]!.note).toBe("Hello, <script>.");
    expect(run.scripts).toBe(1);
    expect(run.ok).toBe(false);
    expect(run.stamp).toBe("script");
    expect(run.note).toBe("Raw payload becomes a script node.");
    expect(run.result).toEqual(["script"]);
  });
});

describe("xss · encoded payload 1 stays text", () => {
  it("encode 1: scripts 0, ok true, stamp text, result &lt;script&gt;", () => {
    // "Leave payload at 1. The first caption is still \"Hello, <script>.\""
    // "Step. scripts is 0. The stamp reads text. The DOM chip is
    // &lt;script&gt;. The last caption: \"Encoded payload stays text.\""
    // "Encoded, the same payload stays text as &lt;script&gt; (scripts 0)."
    const run = at(xssEncodeAlgo, 1);
    expect(run.input).toBe("<script>");
    expect(run.steps[0]!.note).toBe("Hello, <script>.");
    expect(run.scripts).toBe(0);
    expect(run.ok).toBe(true);
    expect(run.stamp).toBe("text");
    expect(run.result).toEqual(["&lt;script&gt;"]);
    expect(run.note).toBe("Encoded payload stays text.");
  });
});
