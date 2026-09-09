import { interleave, type Program } from "./concurrency";
import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  ScenarioOption,
  ScenarioOutcome,
  ScenarioState,
} from "./views/scenario";

/**
 * Branching scenario — a step producer for archetype B, over `ScenarioState`.
 *
 * The eighth thing to ride the discrete-step engine, and the one the G gate was
 * run to justify. The archetype most at risk of degenerating into a quiz with
 * prose consequences, so it is built to make that degeneration impossible: a
 * scenario option does not carry a sentence describing what would happen, it
 * carries a REAL simulation whose parameter the option sets, and the outcome the
 * view shows is MEASURED from running it. The G spike
 * (`scripts/spike-g-scenario.mts`) proved the measured outcomes diverge by
 * choice — 49/200 correct one way, 200/200 the other — before any lesson shipped.
 *
 * WHY THE MEASUREMENT IS THE POINT. A quiz asks "what do you think happens?" and
 * reveals an answer. This asks the same, but the answer is computed by driving a
 * real `interleave()` (or another archetype-B producer) over a sample of seeds
 * per option — so a reader who picks "ship without the lock" is shown the actual
 * distribution of lost updates, not a paragraph asserting there would be some.
 * Change the producer's behaviour and every scenario's numbers move with it,
 * which a prose consequence never would.
 *
 * HOW A CHOICE IS MADE INTERACTIVE. Archetype B has a size slider, not a set of
 * buttons — so the slider IS the choice, exactly as `wal.ts` uses it as the
 * crash point rather than a size. Each slider position selects one option; the
 * run reveals that option's measured outcome and lays it beside the others'. A
 * lesson supplies the scenario and a `measure` function that turns each option
 * into a real run's `ScenarioOutcome`; this producer owns the framing and the
 * comparison. Deterministic and RNG-free at the top level: the sub-runs are
 * seeded internally so a slider position always yields the same measured figure.
 */

/**
 * A scenario option before it is measured — the lesson authors these.
 *
 * There are two ways to supply the real run, and both are genuinely measured
 * (the difference is only which producer drives it):
 *
 *   - `program` + `ok` + `readKey`: the sub-run is a concurrency `interleave()`,
 *     and this producer runs it over the seed sample for you. The common case.
 *   - `run`: the option drives ANOTHER archetype-B producer itself (transactions,
 *     etc.) and returns a `RunResult` per seed. Same measurement, different
 *     engine — this is what keeps the archetype from being an interleave-only
 *     trick.
 *
 * Exactly one of `program` or `run` must be set.
 */
export interface ScenarioChoice {
  id: string;
  label: string;
  /** Concurrency sub-run driver: the parameterised program for a given seed. */
  program?: (seed: number) => Program;
  /** Reduce a concurrency sub-run's final memory to "went well". */
  ok?: (finalMemory: Record<string, number>) => boolean;
  /** The memory key whose final value the headline reports (concurrency case). */
  readKey?: string;
  /**
   * Arbitrary-producer driver: run one seed and report an outcome. Lets a
   * scenario drive `runTransactions` or any other real producer while still
   * being measured over the sample.
   */
  run?: (seed: number) => RunResult;
}

/** The result of one arbitrary sub-run: did it go well, and what to report. */
export interface RunResult {
  ok: boolean;
  /** The measured value this seed contributes to the headline's value set. */
  value: number;
}

export interface ScenarioSpec {
  prompt: string;
  /** Human name of the parameter the options differ on ("mutex on the counter"). */
  parameter: string;
  choices: ScenarioChoice[];
  /**
   * Summarise the chosen option's measured outcome for the verdict banner.
   *
   * CONTRACT: the returned string MUST be assembled only from the measured
   * `ScenarioOutcome` fields of its arguments (`score`, `value`, `outOf`,
   * `headline`) — never from authored prose. The structural gate (G) requires
   * every consequence shown to a reader to be measured, not described, so the
   * verdict is the last mile of that promise: it phrases numbers the sub-runs
   * produced, it does not editorialize.
   */
  verdict: (chosen: MeasuredChoice, all: MeasuredChoice[]) => string;
  /** Seeds to sample each option over. Deterministic; same sample every build. */
  sampleSize?: number;
}

/** An option after its real sub-runs have been measured. */
export interface MeasuredChoice {
  id: string;
  label: string;
  outcome: ScenarioOutcome;
}

export const SCENARIO_COUNTERS = {
  /** Options whose real run has been measured and revealed. */
  measured: "measured",
  /** Sub-runs executed to produce the measured outcomes — the honest cost. */
  runs: "runs",
} as const;

/** The size control: one position per option, so the slider picks the choice. */
export function scenarioSize(spec: ScenarioSpec) {
  return {
    label: "your call",
    min: 0,
    max: spec.choices.length - 1,
    default: 0,
  };
}

/**
 * Measure one option by driving its real program over the sample of seeds and
 * counting how many finished "ok". The headline and score come straight from
 * that count — nothing is authored.
 */
function measure(choice: ScenarioChoice, sampleSize: number): MeasuredChoice {
  let ok = 0;
  const finals = new Set<number>();
  const readLabel = choice.readKey ?? "outcome";

  for (let seed = 0; seed < sampleSize; seed++) {
    if (choice.run) {
      const result = choice.run(seed);
      if (result.ok) ok += 1;
      finals.add(result.value);
    } else if (choice.program && choice.ok && choice.readKey) {
      const steps = interleave(choice.program(seed), mulberry(seed));
      const memory = steps[steps.length - 1].state.memory;
      if (choice.ok(memory)) ok += 1;
      finals.add(memory[choice.readKey]);
    } else {
      throw new Error(`scenario option "${choice.id}" needs either program+ok+readKey or run`);
    }
  }

  const sorted = [...finals].sort((a, b) => a - b);
  const outcome: ScenarioOutcome = {
    headline: `${readLabel} ${sorted.length > 1 ? "ranged " : "held "}${sorted.join(" to ")} — held in ${ok}/${sampleSize} runs`,
    score: ok / sampleSize,
    value: ok,
    outOf: sampleSize,
  };
  return { id: choice.id, label: choice.label, outcome };
}

function toOptions(measured: MeasuredChoice[], chosenId: string | null): ScenarioOption[] {
  return measured.map((m) => ({
    id: m.id,
    label: m.label,
    outcome: m.outcome,
    chosen: m.id === chosenId,
  }));
}

/** What `generateInput(rng, size)` produces: the scenario plus the slider's pick. */
export interface ScenarioInput {
  spec: ScenarioSpec;
  choiceIndex: number;
}

/**
 * Build the scenario input from the size-slider position. The slider IS the
 * choice, so `size` selects which option is chosen; a def wires this into
 * `generateInput` so the choice reaches `run` (which never sees `size` directly).
 */
export function scenarioInput(spec: ScenarioSpec, size: number): ScenarioInput {
  return { spec, choiceIndex: size };
}

/**
 * Run the scenario for a given chosen index (the slider position). Frame 0 is
 * the situation with no choice made; frame 1 reveals the chosen option's
 * measured run beside the alternatives, and the verdict drawn from data.
 */
export function runScenario(spec: ScenarioSpec, choiceIndex: number): AlgoStep<ScenarioState>[] {
  const sampleSize = spec.sampleSize ?? 200;
  // Measure every option up front so the comparison is real: the reader sees
  // what they picked AND what the others would have measured.
  const measured = spec.choices.map((c) => measure(c, sampleSize));

  let snapshot: ScenarioState = {
    prompt: spec.prompt,
    parameter: spec.parameter,
    options: toOptions(measured, null),
    chosenId: null,
    sampleSize,
  };

  const rec = new StepRecorder<ScenarioState>(() => snapshot);
  rec.record({ note: spec.prompt });

  const idx = Math.max(0, Math.min(choiceIndex, spec.choices.length - 1));
  const chosen = measured[idx];

  // The measurement cost is honest: sampleSize sub-runs per option.
  for (let i = 0; i < measured.length; i++) rec.bump(SCENARIO_COUNTERS.runs, sampleSize);
  rec.bump(SCENARIO_COUNTERS.measured, measured.length);

  snapshot = {
    prompt: spec.prompt,
    parameter: spec.parameter,
    options: toOptions(measured, chosen.id),
    chosenId: chosen.id,
    verdict: spec.verdict(chosen, measured),
    sampleSize,
  };
  rec.record({ note: `You chose: ${chosen.label}` });

  return rec.steps;
}

/**
 * A small seeded RNG for the sub-runs — the same GENERATOR as `@/engine/rng`'s
 * `mulberry32` (identical step function), kept local so the scenario producer
 * never reaches for `Math.random` (lint-banned) and never depends on the
 * top-level RNG the size slider does not thread here.
 *
 * MUST STAY ARITHMETICALLY IDENTICAL to `mulberry32`'s step: a scenario's
 * measured figures (and the committed claim numbers in on-call-claims.test.ts)
 * would move silently if the generator diverged.
 *
 * NOTE — do NOT replace this with a bare `mulberry32(seed)` import: the seed
 * mixing here differs deliberately (`seed + 0x6d2b79f5` vs `mulberry32`'s
 * `seed >>> 0`), so the two produce different sequences for the same seed. The
 * measured goldens were pinned against THIS seeding; switching to the exported
 * initializer would change every scenario's numbers. If a shared, offset-aware
 * factory is ever added to `@/engine/rng`, prefer importing that — but only
 * after confirming the claim numbers are unchanged.
 */
function mulberry(seed: number): () => number {
  let a = seed + 0x6d2b79f5;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
