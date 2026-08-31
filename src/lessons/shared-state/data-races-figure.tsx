"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { dataRacesAlgo, dataRacesGuardedAlgo } from "./data-races";

/**
 * The RSC boundary for an archetype-B lesson, same rule as archetype A: an
 * `AlgoDef` carries functions, so it cannot cross the server→client prop
 * boundary. The server page imports these wrappers, never the def.
 *
 * This is also the only file allowed to name a view COMPONENT — lint bans
 * lessons from importing the figure and the player, but a `-figure.tsx` wrapper
 * is already `"use client"`, so wiring `view={ThreadsView}` belongs here.
 */

export function DataRacesFigure() {
  return (
    <SectionAlgoFigure
      def={dataRacesAlgo}
      view={ThreadsView}
      description="Three threads each run counter++ as read, add, write. The scheduler picks which thread runs next from a seeded random stream, so the interleaving is reproducible: shuffle the seed to find an order that loses an update, then step backward through the exact moment two threads read the same value."
    />
  );
}

export function DataRacesGuardedFigure() {
  return (
    <SectionAlgoFigure
      def={dataRacesGuardedAlgo}
      view={ThreadsView}
      description="The same three operations wrapped in a mutex. Threads still interleave, but only one can hold the lock, so the read-add-write group cannot be cut and the counter always reaches the number of threads."
    />
  );
}
