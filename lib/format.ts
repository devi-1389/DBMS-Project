import { RESORT } from "@/lib/config";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import type { TimeOfDay } from "@/lib/types/guest";

/** A price; zero reads "Complimentary". */
export function formatPrice(amountMinor: number, currency: string = RESORT.currency) {
  if (amountMinor === 0) return "Complimentary";
  return formatAmount(amountMinor, currency);
}

/** A sum of money such as a total or budget; zero reads "₹0". */
export function formatAmount(amountMinor: number, currency: string = RESORT.currency) {
  return new Intl.NumberFormat(RESORT.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (rest) parts.push(`${rest} min`);
  return parts.join(" ");
}

export function formatDifficulty(difficulty: Difficulty) {
  return DIFFICULTY_LABELS[difficulty];
}

// Dates are assembled from parts so server and browser output match exactly.
const shortParts = new Intl.DateTimeFormat("en-US", {
  timeZone: RESORT.timeZone,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const longParts = new Intl.DateTimeFormat("en-US", {
  timeZone: RESORT.timeZone,
  weekday: "long",
  month: "long",
  day: "numeric",
});
const keyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: RESORT.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

const instantParts = new Intl.DateTimeFormat("en-US", {
  timeZone: RESORT.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(formatter: Intl.DateTimeFormat, iso: string) {
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(new Date(iso))) map[part.type] = part.value;
  return map;
}

/** "Mon 2 Nov" */
export function formatDate(iso: string) {
  const p = parts(shortParts, iso);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Monday 2 November" */
export function formatLongDate(iso: string) {
  const p = parts(longParts, iso);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "7:00 am" */
export function formatTime(iso: string) {
  const p = parts(shortParts, iso);
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toLowerCase()}`.trim();
}

export function formatTimeRange(startIso: string, endIso: string) {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/** Resort-local calendar date, "2026-11-02". */
export function toDateKey(iso: string) {
  const p = parts(keyParts, iso);
  return `${p.year}-${p.month}-${p.day}`;
}

export function timeOfDay(iso: string): TimeOfDay {
  const hour = Number(parts(keyParts, iso).hour);
  if (hour < 11) return "morning";
  if (hour < 17) return "daytime";
  return "evening";
}

/** Minutes the resort's zone is ahead of UTC at an instant (+330 for IST). */
function zoneOffsetMinutes(utcMs: number) {
  const p = parts(instantParts, new Date(utcMs).toISOString());
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((wall - Math.floor(utcMs / 60_000) * 60_000) / 60_000);
}

/** The UTC instant of a resort-local date and time, e.g. ("2026-11-03", "07:00"). */
export function resortTime(key: string, time = "00:00") {
  const [year, month, day] = key.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Second pass settles times next to a daylight-saving change.
  const first = wall - zoneOffsetMinutes(wall) * 60_000;
  return new Date(wall - zoneOffsetMinutes(first) * 60_000);
}

/** Start of a resort-local day. */
export function resortDayStart(key: string) {
  return resortTime(key);
}

/** Inclusive resort-local date keys → half-open UTC window for queries. */
export function resortDayWindow(fromKey: string, toKey: string) {
  return { from: resortDayStart(fromKey), to: resortDayStart(addDays(toKey, 1)) };
}

/** Midday on a date key, safe to format without shifting the calendar day. */
export function dateKeyToIso(key: string) {
  return resortTime(key, "12:00").toISOString();
}

export function formatDateKey(key: string, style: "short" | "long" = "short") {
  return style === "long" ? formatLongDate(dateKeyToIso(key)) : formatDate(dateKeyToIso(key));
}

export function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Round-trip so rolled-over dates such as 2026-02-30 are rejected.
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** "a", "a and b", "a, b and c" */
export function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
