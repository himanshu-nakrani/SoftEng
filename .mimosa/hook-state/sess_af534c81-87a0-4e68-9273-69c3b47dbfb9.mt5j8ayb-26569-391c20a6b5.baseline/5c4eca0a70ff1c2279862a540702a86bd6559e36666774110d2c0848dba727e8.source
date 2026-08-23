/**
 * Schematic-drawing corner marks. Absolutely positioned inside any
 * `relative` container — frames content like a figure in an engineering
 * drawing. The quiet detail that makes stages read as instruments.
 */
export function CornerTicks({ inset = 6 }: { inset?: number }) {
  const base = "pointer-events-none absolute size-2.5 border-fg-faint/60";
  const off = `${inset}px`;
  return (
    <>
      <span
        aria-hidden
        className={`${base} border-t border-l`}
        style={{ top: off, left: off }}
      />
      <span
        aria-hidden
        className={`${base} border-t border-r`}
        style={{ top: off, right: off }}
      />
      <span
        aria-hidden
        className={`${base} border-b border-l`}
        style={{ bottom: off, left: off }}
      />
      <span
        aria-hidden
        className={`${base} border-b border-r`}
        style={{ bottom: off, right: off }}
      />
    </>
  );
}
