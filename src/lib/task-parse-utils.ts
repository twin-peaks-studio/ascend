import { addDays, addWeeks, addMonths, endOfMonth, endOfWeek } from "date-fns";

// ─── Internal helpers ──────────────────────────────────────────────────────────

function setEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Returns the next occurrence of `targetDay` (0=Sun … 6=Sat) strictly after
 * `from`. If today is already that day, advances a full week.
 */
function nextWeekdayOccurrence(from: Date, targetDay: number): Date {
  const current = from.getDay();
  let daysAhead = targetDay - current;
  if (daysAhead <= 0) daysAhead += 7;
  return setEndOfDay(addDays(from, daysAhead));
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Extracts a due date from free-form text using regex + date-fns arithmetic.
 * No AI, no network — runs synchronously.
 *
 * Handled patterns (case-insensitive):
 *   today, tomorrow, next week, next month,
 *   end of (the/this) week, end of (the/this) month,
 *   in X days/weeks/months,
 *   [next/this] monday … sunday
 */
export function extractDateFromText(text: string, now: Date): Date | null {
  const lower = text.toLowerCase();

  if (/\btoday\b/.test(lower)) return setEndOfDay(now);
  if (/\btomorrow\b/.test(lower)) return setEndOfDay(addDays(now, 1));
  if (/\bnext week\b/.test(lower)) return setEndOfDay(addWeeks(now, 1));
  if (/\bnext month\b/.test(lower)) return setEndOfDay(addMonths(now, 1));
  if (/\bend of (the |this )?week\b/.test(lower))
    return setEndOfDay(endOfWeek(now, { weekStartsOn: 1 }));
  if (/\bend of (the |this )?month\b/.test(lower))
    return setEndOfDay(endOfMonth(now));

  const relMatch = lower.match(/\bin (\d+) (day|days|week|weeks|month|months)\b/);
  if (relMatch) {
    const n = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    if (unit.startsWith("day")) return setEndOfDay(addDays(now, n));
    if (unit.startsWith("week")) return setEndOfDay(addWeeks(now, n));
    if (unit.startsWith("month")) return setEndOfDay(addMonths(now, n));
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [name, index] of Object.entries(weekdays)) {
    if (new RegExp(`\\b(next |this )?${name}\\b`).test(lower)) {
      return nextWeekdayOccurrence(now, index);
    }
  }

  return null;
}

/**
 * Detects priority level from free-form text using keyword matching.
 * Defaults to "medium" when no signal is found.
 */
export function extractPriority(
  text: string
): "low" | "medium" | "high" | "urgent" {
  const lower = text.toLowerCase();

  if (
    /\b(urgent|asap|critical|emergency|immediately|right away|as soon as possible)\b/.test(
      lower
    )
  )
    return "urgent";

  if (
    /\b(important|high priority|high-priority|very important|pretty important|really important|top priority|must|crucial)\b/.test(
      lower
    )
  )
    return "high";

  if (
    /\b(low priority|low-priority|not urgent|when (you|i) can|minor|whenever|no rush)\b/.test(
      lower
    )
  )
    return "low";

  return "medium";
}

/**
 * Produces a best-effort title from raw input when the AI call fails.
 * Strips common filler phrases, takes the first sentence, caps at 60 chars.
 */
export function fallbackTitle(text: string): string {
  const cleaned = text
    .replace(
      /\b(i need to|i have to|i should|make sure to|don't forget to|remember to|we need to|need to|have to)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  const firstSentence = cleaned.split(/[.!?\n]/)[0].trim();
  const source = firstSentence || cleaned || text;

  if (source.length <= 60) return source;

  const truncated = source.substring(0, 57);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "…";
}
