import { createHash } from "crypto";

/**
 * Generate Gravatar URL from email
 * Used as fallback when user hasn't uploaded custom avatar
 *
 * @param email - User's email address
 * @param size - Image size in pixels (default: 200)
 * @returns Gravatar URL
 *
 * @example
 * getGravatarUrl("user@example.com", 80)
 * // => "https://www.gravatar.com/avatar/b58996c504c5638798eb6b511e6f49af?s=80&d=mp"
 */
export function getGravatarUrl(email: string, size: number = 200): string {
  // Gravatar requires lowercase, trimmed email
  const normalizedEmail = email.toLowerCase().trim();

  // Generate MD5 hash
  const hash = createHash("md5").update(normalizedEmail).digest("hex");

  // Generate Gravatar URL
  // d=mp uses "mystery person" default avatar (neutral silhouette)
  // d=identicon uses geometric pattern based on hash
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}

/**
 * Get avatar URL with Gravatar fallback
 * Returns custom avatar if available, otherwise Gravatar
 *
 * @param avatarUrl - User's custom avatar URL (can be null/undefined)
 * @param email - User's email for Gravatar fallback
 * @param size - Desired avatar size
 * @returns Avatar URL (custom or Gravatar)
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
  email: string,
  size: number = 200
): string {
  return avatarUrl || getGravatarUrl(email, size);
}
