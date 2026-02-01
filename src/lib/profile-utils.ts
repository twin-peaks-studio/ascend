/**
 * Profile utility functions for avatar display and user information.
 */
import type { Profile } from "@/types";

/**
 * Get initials from display name or email for avatar display.
 * Returns up to 2 characters.
 */
export function getInitials(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  if (displayName) {
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
}

/**
 * Get initials from a Profile object.
 * Convenience wrapper around getInitials.
 */
export function getProfileInitials(profile: Profile): string {
  return getInitials(profile.display_name, profile.email);
}

/**
 * Get display name from profile, falling back to email.
 */
export function getDisplayName(profile: Profile): string {
  return profile.display_name || profile.email || "Unknown User";
}
