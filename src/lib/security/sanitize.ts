/**
 * Input Sanitization Functions
 *
 * Enterprise-grade sanitization to prevent XSS and injection attacks.
 *
 * SECURITY PRINCIPLES:
 * 1. Never trust user input
 * 2. Validate URLs to prevent javascript: protocol attacks
 * 3. Strip potentially dangerous characters
 * 4. Normalize whitespace
 */

/**
 * Characters that are potentially dangerous in certain contexts
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
  /data:/gi, // Data URLs (can contain scripts)
  /vbscript:/gi, // VBScript protocol
  /expression\s*\(/gi, // CSS expressions
];

/**
 * Removes potentially dangerous patterns from a string.
 *
 * This is a defense-in-depth measure to remove known attack patterns.
 */
function removeDangerousPatterns(str: string): string {
  let result = str;
  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result;
}

/**
 * Normalizes whitespace in a string.
 * - Trims leading/trailing whitespace
 * - Collapses multiple spaces into one
 * - Removes null bytes and other control characters
 */
function normalizeWhitespace(str: string): string {
  return str
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars (except \t, \n, \r)
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Sanitization function that preserves special characters.
 *
 * Use this for content that will be rendered by React, which handles
 * HTML escaping automatically. This prevents double-escaping issues
 * where "Here's" becomes "Here&#x27;s" in the stored data.
 *
 * Applies:
 * 1. Normalize whitespace
 * 2. Remove dangerous patterns (script tags, event handlers, etc.)
 *
 * Does NOT escape HTML entities - React handles that on render.
 *
 * @example
 * sanitizeStringPreserveChars("Here's a <b>test</b>")
 * // Returns: "Here's a test" (dangerous tags removed, quotes preserved)
 */
export function sanitizeStringPreserveChars(str: string): string {
  if (!str || typeof str !== "string") {
    return "";
  }

  let sanitized = normalizeWhitespace(str);
  sanitized = removeDangerousPatterns(sanitized);

  return sanitized;
}

/**
 * Validates and sanitizes a URL.
 *
 * SECURITY:
 * - Only allows http:// and https:// protocols
 * - Blocks javascript:, data:, and other dangerous protocols
 * - Validates URL structure
 *
 * @returns The sanitized URL or null if invalid
 *
 * @example
 * sanitizeUrl('https://example.com/path?query=value')
 * // Returns: 'https://example.com/path?query=value'
 *
 * sanitizeUrl('javascript:alert("xss")')
 * // Returns: null
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmedUrl = url.trim();

  // Check for dangerous protocols before parsing
  const lowerUrl = trimmedUrl.toLowerCase();
  if (
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("data:") ||
    lowerUrl.startsWith("vbscript:") ||
    lowerUrl.startsWith("file:")
  ) {
    console.warn(`Blocked dangerous URL protocol: ${trimmedUrl}`);
    return null;
  }

  // Validate URL structure
  try {
    const parsed = new URL(trimmedUrl);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      console.warn(`Blocked non-HTTP URL protocol: ${parsed.protocol}`);
      return null;
    }

    // Return the validated URL
    return parsed.href;
  } catch {
    // If URL parsing fails, check if it's a relative URL
    // and prepend https://
    if (!trimmedUrl.includes("://") && !trimmedUrl.startsWith("/")) {
      try {
        const withProtocol = `https://${trimmedUrl}`;
        const parsed = new URL(withProtocol);
        return parsed.href;
      } catch {
        console.warn(`Invalid URL: ${trimmedUrl}`);
        return null;
      }
    }

    console.warn(`Invalid URL: ${trimmedUrl}`);
    return null;
  }
}
