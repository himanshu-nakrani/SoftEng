"use client";

import { Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

type Appearance = "light" | "dark";

const STORAGE_KEY = "syslab-appearance";
const emptySubscribe = () => () => {};

function documentAppearance(): Appearance {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  root.dataset.theme = appearance;
  root.classList.toggle("dark", appearance === "dark");
}

/**
 * A deliberately compact, persistent appearance control. The document-level
 * theme variables update both the interface and the inline SVG simulations;
 * their local dark-lab scope remains stable in either application theme.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const initialDocumentTheme = useSyncExternalStore(
    emptySubscribe,
    documentAppearance,
    () => "light" as Appearance,
  );
  const [override, setOverride] = useState<Appearance | null>(null);
  const current = override ?? initialDocumentTheme;
  const next = current === "light" ? "dark" : "light";

  function toggle() {
    setOverride(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyAppearance(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={current === "dark"}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`theme-toggle ${className}`}
    >
      <Sun aria-hidden="true" className="size-3.5" />
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      <Moon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">Current appearance: {current}</span>
    </button>
  );
}

export { STORAGE_KEY as appearanceStorageKey };
