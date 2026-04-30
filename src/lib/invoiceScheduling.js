import { nextFriday, isEqual, parseISO, format } from "date-fns";

/**
 * Get the next Friday for a given date
 * If the date is already a Friday, return the following Friday
 */
export function getNextFriday(date = new Date()) {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  const next = nextFriday(d);
  return format(next, 'yyyy-MM-dd');
}

/**
 * When an invoice is approved, schedule it for the next Friday
 */
export function schedulePaymentForApproval() {
  return getNextFriday();
}

/**
 * If an invoice is already scheduled on a Friday, move it to next Friday
 */
export function rescheduleToNextFriday(currentFriday) {
  const current = typeof currentFriday === 'string' ? parseISO(currentFriday) : new Date(currentFriday);
  return format(nextFriday(current), 'yyyy-MM-dd');
}