/**
 * @mention Parser Utility
 *
 * Utilities for parsing and handling @mentions in comments.
 * Supports @username mentions and converts them to user IDs for notifications.
 */

import type { Profile } from "@/types";

/**
 * Regular expression to match @mentions
 * Matches: @username, @user-name, @user_name, @user.name
 * Does not match: email@domain.com (requires word boundary before @)
 */
const MENTION_REGEX = /\B@([\w\-\.]+)/g;

/**
 * Extract all @mention patterns from text
 * Returns an array of mentioned usernames (without the @ symbol)
 *
 * @param text - The text content to parse
 * @returns Array of mentioned usernames
 *
 * @example
 * extractMentionPatterns("Hey @john, can you review this with @jane?")
 * // Returns: ["john", "jane"]
 */
export function extractMentionPatterns(text: string): string[] {
  const mentions: string[] = [];
  const matches = text.matchAll(MENTION_REGEX);

  for (const match of matches) {
    const username = match[1];
    if (username && !mentions.includes(username)) {
      mentions.push(username);
    }
  }

  return mentions;
}

/**
 * Match a username against a profile
 * Matches against display_name (case-insensitive)
 *
 * @param username - The mentioned username to match
 * @param profile - The profile to check against
 * @returns true if the username matches the profile
 */
function matchesProfile(username: string, profile: Profile): boolean {
  const lowerUsername = username.toLowerCase();

  // Match against display_name
  if (profile.display_name) {
    const displayName = profile.display_name.toLowerCase();
    // Exact match or match without spaces
    if (
      displayName === lowerUsername ||
      displayName.replace(/\s+/g, "") === lowerUsername ||
      displayName.replace(/\s+/g, "-") === lowerUsername ||
      displayName.replace(/\s+/g, "_") === lowerUsername
    ) {
      return true;
    }
  }

  // Match against email username (before the @)
  if (profile.email) {
    const emailUsername = profile.email.split("@")[0].toLowerCase();
    if (emailUsername === lowerUsername) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve @mention patterns to actual user profiles
 *
 * @param text - The text content containing @mentions
 * @param profiles - Array of available user profiles to match against
 * @returns Array of Profile objects that were mentioned
 *
 * @example
 * const profiles = [
 *   { id: "1", display_name: "John Doe", email: "john@example.com" },
 *   { id: "2", display_name: "Jane Smith", email: "jane@example.com" }
 * ];
 * resolveMentions("Hey @john, can you help @jane?", profiles)
 * // Returns: [Profile{id: "1", ...}, Profile{id: "2", ...}]
 */
export function resolveMentions(text: string, profiles: Profile[]): Profile[] {
  const mentionPatterns = extractMentionPatterns(text);
  const mentionedProfiles: Profile[] = [];

  for (const username of mentionPatterns) {
    const matchedProfile = profiles.find((profile) =>
      matchesProfile(username, profile)
    );

    if (matchedProfile && !mentionedProfiles.some((p) => p.id === matchedProfile.id)) {
      mentionedProfiles.push(matchedProfile);
    }
  }

  return mentionedProfiles;
}

/**
 * Get user IDs from @mentions in text
 *
 * @param text - The text content containing @mentions
 * @param profiles - Array of available user profiles to match against
 * @returns Array of user IDs that were mentioned
 *
 * @example
 * getMentionedUserIds("@john @jane please review", profiles)
 * // Returns: ["user-id-1", "user-id-2"]
 */
export function getMentionedUserIds(text: string, profiles: Profile[]): string[] {
  return resolveMentions(text, profiles).map((profile) => profile.id);
}

/**
 * Check if text contains any @mentions
 *
 * @param text - The text content to check
 * @returns true if the text contains at least one @mention
 */
export function hasMentions(text: string): boolean {
  return MENTION_REGEX.test(text);
}

/**
 * Highlight @mentions in text by wrapping them in a span
 * Useful for rendering mentions with custom styling
 *
 * @param text - The text content to process
 * @param profiles - Array of available profiles to validate mentions
 * @returns Text with valid mentions wrapped in spans
 *
 * @example
 * highlightMentions("Hey @john!", profiles)
 * // Returns: "Hey <span class='mention'>@john</span>!"
 */
export function highlightMentions(text: string, profiles: Profile[]): string {
  const validUsernames = new Set<string>();

  // Build set of valid usernames
  for (const profile of profiles) {
    if (profile.display_name) {
      const normalized = profile.display_name
        .toLowerCase()
        .replace(/\s+/g, "");
      validUsernames.add(normalized);
    }
    if (profile.email) {
      const emailUsername = profile.email.split("@")[0].toLowerCase();
      validUsernames.add(emailUsername);
    }
  }

  return text.replace(MENTION_REGEX, (match, username) => {
    const normalized = username.toLowerCase();
    const isValid = Array.from(validUsernames).some((validName) => {
      return (
        validName === normalized ||
        validName === normalized.replace(/[-_\.]/g, "")
      );
    });

    if (isValid) {
      return `<span class="mention text-primary font-medium">${match}</span>`;
    }
    return match;
  });
}
