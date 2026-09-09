"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { mutexAlgo, rwLockAlgo } from "./read-write-locks";

export function RwLockFigure() {
  return (
    <SectionAlgoFigure
      def={rwLockAlgo}
      view={ThreadsView}
      description="Three readers and one writer share data through a reader count and a writer flag. Readers enter together — watch the readers count climb above one — while the writer waits for an empty room. Blocking stays roughly flat as readers are added, because readers never exclude each other."
    />
  );
}

export function MutexFigure() {
  return (
    <SectionAlgoFigure
      def={mutexAlgo}
      view={ThreadsView}
      description="The same readers and writer under one exclusive lock. Only one thread is ever inside, so readers now queue behind readers, and blocked turns grow with the square of the thread count instead of staying flat."
    />
  );
}
