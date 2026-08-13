"use client";

import { Moon, Palette, RotateCcw, SlidersHorizontal, Sun, Type } from "lucide-react";
import { useState, useSyncExternalStore, type CSSProperties } from "react";

type Appearance = "light" | "dark";
type ReadingSize = "compact" | "default" | "comfortable";

type Preferences = {
  accent: string;
  readingSize: ReadingSize;
};

const APPEARANCE_STORAGE_KEY = "syslab-appearance";
const ACCENT_STORAGE_KEY = "syslab-accent";
const READING_SIZE_STORAGE_KEY = "syslab-reading-size";
const emptySubscribe = () => () => {};

const ACCENT_PRESETS = [
  { name: "Cobalt", value: "#2f73a8" },
  { name: "Teal", value: "#167c7a" },
  { name: "Plum", value: "#7453a6" },
  { name: "Terracotta", value: "#b95c42" },
] as const;

const READING_SIZES: ReadonlyArray<{
  id: ReadingSize;
  label: string;
  description: string;
}> = [
  { id: "compact", label: "A−", description: "Compact" },
  { id: "default", label: "A", description: "Default" },
  { id: "comfortable", label: "A+", description: "Comfortable" },
];

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_PREFERENCES: Preferences = {
  accent: ACCENT_PRESETS[0].value,
  readingSize: "default",
};

function isReadingSize(value: string | undefined): value is ReadingSize {
  return value === "compact" || value === "default" || value === "comfortable";
}

function documentAppearance(): Appearance {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function preferencesSnapshot() {
  const root = document.documentElement;
  const savedAccent = root.style.getPropertyValue("--user-accent").trim();
  const accent = HEX.test(savedAccent) ? savedAccent : DEFAULT_PREFERENCES.accent;
  const readingSize = isReadingSize(root.dataset.readingSize)
    ? root.dataset.readingSize
    : DEFAULT_PREFERENCES.readingSize;
  return `${accent}|${readingSize}`;
}

function parsePreferences(snapshot: string): Preferences {
  const [accent, readingSize] = snapshot.split("|");
  return {
    accent: HEX.test(accent) ? accent : DEFAULT_PREFERENCES.accent,
    readingSize: isReadingSize(readingSize)
      ? readingSize
      : DEFAULT_PREFERENCES.readingSize,
  };
}

function accentInk(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return "#10201f";
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.34 ? "#10201f" : "#fffdf7";
}

function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  root.dataset.theme = appearance;
  root.classList.toggle("dark", appearance === "dark");
}

function applyAccent(accent: string) {
  if (!HEX.test(accent)) return;
  const root = document.documentElement;
  root.style.setProperty("--user-accent", accent);
  root.style.setProperty("--color-accent", accent);
  root.style.setProperty("--color-accent-dim", `color-mix(in srgb, ${accent} 14%, transparent)`);
  root.style.setProperty("--color-accent-ink", accentInk(accent));
}

function applyReadingSize(readingSize: ReadingSize) {
  document.documentElement.dataset.readingSize = readingSize;
}

/**
 * A persistent appearance control built for a learning product rather than a
 * generic settings screen. Appearance remains one immediate action; adjacent
 * controls reveal an intentionally small personalization panel for color and
 * reading comfort. Every setting is saved locally and applied to document
 * tokens, so inline SVG labs and routed pages stay in sync.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const documentTheme = useSyncExternalStore(
    emptySubscribe,
    documentAppearance,
    () => "light" as Appearance,
  );
  const documentPreferenceSnapshot = useSyncExternalStore(
    emptySubscribe,
    preferencesSnapshot,
    () => `${DEFAULT_PREFERENCES.accent}|${DEFAULT_PREFERENCES.readingSize}`,
  );
  const [appearanceOverride, setAppearanceOverride] = useState<Appearance | null>(null);
  const [preferencesOverride, setPreferencesOverride] = useState<Preferences | null>(null);
  const [open, setOpen] = useState(false);

  const appearance = appearanceOverride ?? documentTheme;
  const preferences = preferencesOverride ?? parsePreferences(documentPreferenceSnapshot);
  const nextAppearance = appearance === "light" ? "dark" : "light";

  function toggleAppearance() {
    setAppearanceOverride(nextAppearance);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, nextAppearance);
    applyAppearance(nextAppearance);
  }

  function chooseAccent(accent: string) {
    const normalized = accent.toUpperCase();
    if (!HEX.test(normalized)) return;
    const next = { ...preferences, accent: normalized };
    setPreferencesOverride(next);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
    applyAccent(normalized);
  }

  function chooseReadingSize(readingSize: ReadingSize) {
    const next = { ...preferences, readingSize };
    setPreferencesOverride(next);
    window.localStorage.setItem(READING_SIZE_STORAGE_KEY, readingSize);
    applyReadingSize(readingSize);
  }

  function resetPersonalization() {
    const root = document.documentElement;
    window.localStorage.removeItem(ACCENT_STORAGE_KEY);
    window.localStorage.removeItem(READING_SIZE_STORAGE_KEY);
    root.style.removeProperty("--user-accent");
    root.style.removeProperty("--color-accent");
    root.style.removeProperty("--color-accent-dim");
    root.style.removeProperty("--color-accent-ink");
    delete root.dataset.readingSize;
    setPreferencesOverride(DEFAULT_PREFERENCES);
  }

  return (
    <div className={`appearance-controls ${className}`} onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        setOpen(false);
      }
    }}>
      <button
        type="button"
        onClick={toggleAppearance}
        aria-pressed={appearance === "dark"}
        aria-label={`Switch to ${nextAppearance} mode`}
        title={`Switch to ${nextAppearance} mode`}
        className="theme-toggle"
      >
        <Sun aria-hidden="true" className="size-3.5" />
        <span className="theme-toggle-track" aria-hidden="true">
          <span className="theme-toggle-thumb" />
        </span>
        <Moon aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Current appearance: {appearance}</span>
      </button>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="appearance-personalization-panel"
        aria-label="Customize color and reading size"
        title="Customize color and reading size"
        className="appearance-settings-trigger"
      >
        <SlidersHorizontal aria-hidden="true" className="size-3.5" />
      </button>

      {open && (
        <section
          id="appearance-personalization-panel"
          aria-label="Appearance preferences"
          className="appearance-personalization-panel"
        >
          <div className="appearance-panel-heading">
            <span className="tech-label">your workspace</span>
            <button
              type="button"
              onClick={resetPersonalization}
              className="appearance-reset"
              title="Reset color and reading size"
            >
              <RotateCcw aria-hidden="true" className="size-3" />
              Reset
            </button>
          </div>

          <fieldset className="appearance-panel-group">
            <legend className="appearance-panel-label">
              <Palette aria-hidden="true" className="size-3.5" />
              Accent color
            </legend>
            <div className="appearance-swatch-row" role="radiogroup" aria-label="Accent color">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  role="radio"
                  aria-checked={preferences.accent.toLowerCase() === preset.value.toLowerCase()}
                  aria-label={`${preset.name} accent`}
                  title={preset.name}
                  className="appearance-swatch"
                  style={{ "--swatch": preset.value } as CSSProperties}
                  onClick={() => chooseAccent(preset.value)}
                />
              ))}
              <label className="appearance-custom-swatch" title="Choose a custom accent color">
                <span className="sr-only">Custom accent color</span>
                <input
                  type="color"
                  aria-label="Custom accent color"
                  value={preferences.accent}
                  onChange={(event) => chooseAccent(event.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="appearance-panel-group">
            <legend className="appearance-panel-label">
              <Type aria-hidden="true" className="size-3.5" />
              Reading size
            </legend>
            <div className="appearance-size-row" role="radiogroup" aria-label="Reading size">
              {READING_SIZES.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  role="radio"
                  aria-checked={preferences.readingSize === size.id}
                  onClick={() => chooseReadingSize(size.id)}
                  className="appearance-size-option"
                  title={size.description}
                >
                  <span aria-hidden="true">{size.label}</span>
                  <span className="sr-only">{size.description} reading size</span>
                </button>
              ))}
            </div>
          </fieldset>
          <p className="appearance-panel-note">Saved on this device.</p>
        </section>
      )}
    </div>
  );
}

export {
  ACCENT_STORAGE_KEY as accentStorageKey,
  APPEARANCE_STORAGE_KEY as appearanceStorageKey,
  READING_SIZE_STORAGE_KEY as readingSizeStorageKey,
};
