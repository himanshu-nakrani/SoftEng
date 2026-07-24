import { clsx, type ClassValue } from "clsx";

/** Class-name composition helper used across all components. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
