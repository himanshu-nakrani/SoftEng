import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHydrated } from "../use-hydrated";
import { useModuleProgress } from "../use-lesson-progress";
import { tracks } from "@/lib/curriculum";

describe("useHydrated (rendering test in jsdom)", () => {
  it("returns true upon client mount in DOM environment", () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });

  it("enables progress reading when hydrated on client", () => {
    const firstModule = tracks[0].modules[0];
    const { result } = renderHook(() => useModuleProgress(firstModule));
    // When hydrated, progress hook executes and returns a real fraction (0..1)
    expect(typeof result.current).toBe("number");
    expect(result.current).toBeGreaterThanOrEqual(0);
    expect(result.current).toBeLessThanOrEqual(1);
  });
});
