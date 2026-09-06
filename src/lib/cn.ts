/** Join class names. Falsy entries drop. Later strings do not un-set earlier utilities. */
export function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}
