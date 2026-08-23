"use client";

import { InteractiveFigure } from "@/engine/components/InteractiveFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { SimEvent } from "@/engine/useSimulation";
import type { LessonSim, NodeSpec } from "@/engine/types";
import { quizKey, useProgress } from "@/stores/progress";
import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  useLessonCompletion,
  useLessonMeta,
  useLessonUi,
  useSectionCompletion,
} from "./context";

/**
 * Routes one sim interaction to a section elsewhere in the lesson — for
 * sections whose subject is a control that lives in another section's figure.
 */
export interface CompletionRule {
  on: SimEvent["kind"];
  /** Param key / button key / node id. Omitted = any id of that kind. */
  id?: string;
  /** quiz-answered only: require the answer to be right. */
  correctOnly?: boolean;
  /** Registry section id to complete. */
  section: string;
}

/**
 * `?t=<sim-seconds>` → a seek target, or undefined when the URL says nothing
 * usable. Values ≤ 0 are dropped: `t=0` is where the sim already starts, and
 * honouring it would suppress the figure's autoplay for no reason. The runner
 * clamps the upper end itself (`SEEK_LIMIT`).
 */
/**
 * The URL query, read as an external system (the same `useSyncExternalStore`
 * shape as `useHydrated`): `""` for the server/first-hydration render, the real
 * `location.search` from the first client render onward. Never subscribes —
 * see the note in `SectionFigure` on why this is an entry condition.
 */
const neverChanges = () => () => {};
const clientSearch = () => window.location.search;
const noSearch = () => "";

function parseSeekParam(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("t");
  if (raw === null) return undefined;
  const t = Number(raw);
  return Number.isFinite(t) && t > 0 ? t : undefined;
}

interface SectionFigureProps<L> {
  sim: LessonSim<L>;
  description: string;
  autoplay?: boolean;
  seed?: number;
  /**
   * Whether this figure honours the page's `?t=` deep link (default true).
   *
   * Every lesson page today renders exactly one figure, so "always consume it"
   * is correct and needs no coordination. A page that grows a SECOND figure
   * would double-seek — both would replay to the same moment, which is wrong
   * for at least one of them — and the fix is to pass
   * `consumesSeekParam={false}` on the others (or promote this to a
   * first-figure rule owned by the lesson layout). Left as an explicit opt-out
   * rather than magic, so the day it matters the choice is visible in the
   * lesson's own figure file.
   */
  consumesSeekParam?: boolean;
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
  nodeOverlay?: (
    spec: NodeSpec,
    runtime: SimSnapshot["nodes"][string],
    snapshot: SimSnapshot,
  ) => ReactNode;
  completes?: CompletionRule[];
}

/**
 * InteractiveFigure wired into the lesson's progress system: the figure's own
 * section completes on first meaningful interaction, `completes` rules can
 * complete other sections, and quiz checkpoints are recorded. Keeps the
 * engine layer free of any progress/curriculum dependency.
 */
export function SectionFigure<L>({
  sim,
  description,
  autoplay,
  seed,
  consumesSeekParam = true,
  stageOverlay,
  nodeOverlay,
  completes,
}: SectionFigureProps<L>) {
  const markComplete = useSectionCompletion();
  const completeLessonSection = useLessonCompletion();
  const { calibration } = useLessonUi();
  const recordQuiz = useProgress((s) => s.recordQuiz);
  const { slug } = useLessonMeta();

  // Rules are authored inline, so a ref keeps the handler stable.
  const rulesRef = useRef(completes);
  rulesRef.current = completes;

  const onSimEvent = useCallback(
    (ev: SimEvent) => {
      for (const rule of rulesRef.current ?? []) {
        if (rule.on !== ev.kind) continue;
        if (rule.id !== undefined && rule.id !== ev.id) continue;
        if (rule.correctOnly && !(ev.kind === "quiz-answered" && ev.correct)) {
          continue;
        }
        completeLessonSection(rule.section);
      }
    },
    [completeLessonSection],
  );

  const onQuizResult = useCallback(
    (quizId: string, choiceId: string, correct: boolean) => {
      recordQuiz(quizKey(slug, quizId), choiceId, correct);
    },
    [recordQuiz, slug],
  );

  /**
   * The `?t=` deep link, read from `window.location` rather than with
   * `useSearchParams()`.
   *
   * WHY NOT the hook: on a static export (`output: "export"`) `useSearchParams`
   * forces the calling subtree to bail out of prerendering, and Next fails the
   * build unless it sits under `<Suspense>`. Every lesson page renders this
   * component, so that would mean a boundary on all 22 of them — and worse,
   * whatever the boundary wraps is replaced by its fallback in the exported
   * HTML. The figure is the lesson's primary content; shipping a page whose
   * figure only exists after hydration to buy a query param is a bad trade.
   *
   * A static host serves the same document for every query string, so the
   * search is client-only information no matter which API reads it. Reading it
   * through `useSyncExternalStore` gets the identical value one render after
   * hydration, keeps the figure in the prerendered HTML, and needs no Suspense
   * anywhere. The cost is that it is an ENTRY condition, not a live binding: it
   * resolves once per mount (a client-side navigation to another lesson
   * remounts this component, so links from the review deck behave correctly),
   * and a same-page query change without a remount would not re-seek.
   */
  const search = useSyncExternalStore(neverChanges, clientSearch, noSearch);
  const seekT = consumesSeekParam ? parseSeekParam(search) : undefined;

  return (
    <InteractiveFigure
      sim={sim}
      description={description}
      autoplay={autoplay}
      seed={seed}
      initialSeekT={seekT}
      calibrationMode={calibration}
      stageOverlay={stageOverlay}
      nodeOverlay={nodeOverlay}
      onEngage={markComplete}
      onSimEvent={onSimEvent}
      onQuizResult={onQuizResult}
    />
  );
}
