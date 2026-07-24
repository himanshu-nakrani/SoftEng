"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True only after client mount. Server-rendered HTML has no localStorage, so
 * any component reading the progress store MUST render a neutral state until
 * hydrated — otherwise React hydration mismatches. (Static-export safety.)
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
