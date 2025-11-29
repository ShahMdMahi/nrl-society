/**
 * Lightweight date utilities to replace heavy date-fns imports
 * This reduces bundle size significantly compared to date-fns
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Format a date as a relative time string (e.g., "5 minutes ago")
 * Lightweight replacement for date-fns formatDistanceToNow
 */
export function formatRelativeTime(
  date: Date | string | number,
  options?: { addSuffix?: boolean }
): string {
  const now = Date.now();
  const timestamp = new Date(date).getTime();
  const diff = now - timestamp;
  const absDiff = Math.abs(diff);
  const suffix = options?.addSuffix ? (diff > 0 ? " ago" : " from now") : "";

  if (absDiff < MINUTE) {
    return "less than a minute" + suffix;
  }
  if (absDiff < HOUR) {
    const minutes = Math.floor(absDiff / MINUTE);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}` + suffix;
  }
  if (absDiff < DAY) {
    const hours = Math.floor(absDiff / HOUR);
    return `${hours} hour${hours !== 1 ? "s" : ""}` + suffix;
  }
  if (absDiff < WEEK) {
    const days = Math.floor(absDiff / DAY);
    return `${days} day${days !== 1 ? "s" : ""}` + suffix;
  }
  if (absDiff < MONTH) {
    const weeks = Math.floor(absDiff / WEEK);
    return `${weeks} week${weeks !== 1 ? "s" : ""}` + suffix;
  }
  if (absDiff < YEAR) {
    const months = Math.floor(absDiff / MONTH);
    return `${months} month${months !== 1 ? "s" : ""}` + suffix;
  }

  const years = Math.floor(absDiff / YEAR);
  return `${years} year${years !== 1 ? "s" : ""}` + suffix;
}

/**
 * Format a date using a pattern
 * Lightweight replacement for date-fns format
 * Supports: yyyy, MM, dd, HH, mm, ss, MMMM, MMM, EEEE, EEE, h, a
 * Quoted strings like 'at' are preserved as literals
 */
export function formatDate(
  date: Date | string | number,
  pattern: string
): string {
  const d = new Date(date);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const pad = (n: number) => n.toString().padStart(2, "0");

  // First, extract and preserve quoted literals
  const literals: string[] = [];
  let result = pattern.replace(/'([^']+)'/g, (_, literal) => {
    literals.push(literal);
    return `__LITERAL_${literals.length - 1}__`;
  });

  const replacements: Record<string, string> = {
    yyyy: d.getFullYear().toString(),
    MM: pad(d.getMonth() + 1),
    dd: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
    MMMM: monthNames[d.getMonth()],
    MMM: monthNames[d.getMonth()].slice(0, 3),
    EEEE: dayNames[d.getDay()],
    EEE: dayNames[d.getDay()].slice(0, 3),
    d: d.getDate().toString(),
    M: (d.getMonth() + 1).toString(),
    h: (d.getHours() % 12 || 12).toString(),
    a: d.getHours() < 12 ? "AM" : "PM",
  };

  // Sort by length descending to replace longer patterns first
  const sortedKeys = Object.keys(replacements).sort(
    (a, b) => b.length - a.length
  );
  for (const key of sortedKeys) {
    result = result.replace(new RegExp(key, "g"), replacements[key]);
  }

  // Restore quoted literals
  literals.forEach((literal, index) => {
    result = result.replace(`__LITERAL_${index}__`, literal);
  });

  return result;
}

/**
 * Check if the first date is after the second date
 * Lightweight replacement for date-fns isAfter
 */
export function isAfter(
  date: Date | string | number,
  dateToCompare: Date | string | number
): boolean {
  return new Date(date).getTime() > new Date(dateToCompare).getTime();
}

/**
 * Check if the first date is before the second date
 * Lightweight replacement for date-fns isBefore
 */
export function isBefore(
  date: Date | string | number,
  dateToCompare: Date | string | number
): boolean {
  return new Date(date).getTime() < new Date(dateToCompare).getTime();
}

/**
 * Parse an ISO date string into a Date object
 * Lightweight replacement for date-fns parseISO
 */
export function parseISO(dateString: string): Date {
  return new Date(dateString);
}
