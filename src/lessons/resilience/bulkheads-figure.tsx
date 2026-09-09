"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { bulkheadsSim } from "./bulkheads";

/**
 * The lesson renders this figure twice — once in the `shared` section and once
 * in `isolated`. Only the first may consume the page's `?t=` deep link;
 * `consumesSeekParam={false}` on the second stops the two from double-seeking
 * to the same moment.
 */
export function BulkheadsFigure({
  consumesSeekParam = true,
}: {
  consumesSeekParam?: boolean;
}) {
  return (
    <SectionFigure
      sim={bulkheadsSim}
      consumesSeekParam={consumesSeekParam}
      description="Clients call dep-a and dep-b through one fixed pool of concurrency slots. Watch the pool fill with stuck dep-a work when it stalls, then flip ISOLATE THE POOL and watch dep-b get its slots back."
    />
  );
}
