/**
 * Feedback Form Slug Generation
 *
 * Converts a form title to a URL-safe slug and ensures uniqueness
 * against existing slugs in the database.
 *
 * "My Bug Report Form" → "my-bug-report-form"
 * If taken:             → "my-bug-report-form-2", "-3", etc.
 *
 * Slugs are immutable after creation — changing the form title does not
 * change the slug, preventing broken shared URLs.
 */

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Convert an arbitrary string to a URL-safe slug.
 * Strips non-alphanumeric chars, lowercases, collapses hyphens.
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // keep letters, digits, spaces, hyphens
    .replace(/\s+/g, "-")           // spaces → hyphens
    .replace(/-+/g, "-")            // collapse multiple hyphens
    .replace(/^-|-$/g, "")          // strip leading/trailing hyphens
    .slice(0, 80);                   // max 80 chars before suffix
}

/**
 * Generate a unique slug for a new feedback form.
 * Checks the database and appends -2, -3, ... on collision.
 *
 * @param title - The form title set by the developer
 * @returns A slug guaranteed to be unique in feedback_forms.slug
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const supabase = createServiceClient();
  const base = titleToSlug(title) || "feedback-form";

  // Fetch all existing slugs that start with this base (covers base + suffixes)
  const { data: existing } = await supabase
    .from("feedback_forms")
    .select("slug")
    .like("slug", `${base}%`);

  const taken = new Set((existing ?? []).map((r) => r.slug));

  if (!taken.has(base)) return base;

  // Find first unused suffix
  for (let i = 2; i <= 9999; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Extreme fallback — should never be reached in practice
  return `${base}-${Date.now()}`;
}
