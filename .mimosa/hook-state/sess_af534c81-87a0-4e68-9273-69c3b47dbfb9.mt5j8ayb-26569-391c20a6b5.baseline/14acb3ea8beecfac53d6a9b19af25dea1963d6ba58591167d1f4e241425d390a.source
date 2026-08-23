import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name composition. tailwind-merge resolves conflicts by utility group
 * (later wins), so a caller appending e.g. `rounded-md` over a base
 * `rounded-lg` overrides it deterministically instead of by CSS-order luck.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
