import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}


export const isIframe = window.self !== window.top;

// Parse a date for display. Date-only strings ("2026-06-01") are treated as
// LOCAL midnight — new Date("2026-06-01") is UTC midnight, which renders as
// the previous day for US timezones.
export function parseLocalDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}
