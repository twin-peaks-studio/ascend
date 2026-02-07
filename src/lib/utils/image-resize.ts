import sharp from "sharp";

/**
 * Avatar sizes matching Linear's implementation
 * - small: User mentions, task assignees
 * - medium: Comments, activity feed
 * - large: Profile cards, modals
 * - xlarge: Settings page, profile page
 */
export const AVATAR_SIZES = {
  small: 40,
  medium: 80,
  large: 160,
  xlarge: 320,
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * Resize and optimize image for avatar use
 * Generates WebP format for better compression
 *
 * @param buffer - Original image buffer
 * @param size - Target size (will be square)
 * @returns Optimized image buffer
 */
export async function resizeAvatar(
  buffer: Buffer,
  size: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .webp({
      quality: 85,
      effort: 6,
    })
    .toBuffer();
}

/**
 * Generate all avatar sizes from original upload
 * Returns object with buffers for each size
 *
 * @param buffer - Original image buffer
 * @returns Object with { small, medium, large, xlarge } buffers
 */
export async function generateAvatarSizes(buffer: Buffer): Promise<{
  small: Buffer;
  medium: Buffer;
  large: Buffer;
  xlarge: Buffer;
}> {
  const [small, medium, large, xlarge] = await Promise.all([
    resizeAvatar(buffer, AVATAR_SIZES.small),
    resizeAvatar(buffer, AVATAR_SIZES.medium),
    resizeAvatar(buffer, AVATAR_SIZES.large),
    resizeAvatar(buffer, AVATAR_SIZES.xlarge),
  ]);

  return { small, medium, large, xlarge };
}

/**
 * Get avatar URL for specific size
 * Constructs URL path based on size
 *
 * @param baseUrl - Base avatar URL (without size suffix)
 * @param size - Desired size
 * @returns URL for specific avatar size
 *
 * @example
 * getAvatarSizeUrl(
 *   "https://.../avatars/user123/avatar.webp",
 *   "medium"
 * )
 * // => "https://.../avatars/user123/avatar-80.webp"
 */
export function getAvatarSizeUrl(baseUrl: string, size: AvatarSize): string {
  const sizePixels = AVATAR_SIZES[size];
  return baseUrl.replace(/\.webp$/, `-${sizePixels}.webp`);
}
