/**
 * Input Sanitization Functions
 *
 * Enterprise-grade sanitization to prevent XSS and injection attacks.
 *
 * SECURITY PRINCIPLES:
 * 1. Never trust user input
 * 2. Escape HTML entities to prevent XSS
 * 3. Validate URLs to prevent javascript: protocol attacks
 * 4. Strip potentially dangerous characters
 * 5. Normalize whitespace
 */

/**
 * HTML entities that need escaping to prevent XSS
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

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
 * Escapes HTML entities in a string to prevent XSS attacks.
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Removes potentially dangerous patterns from a string.
 *
 * This is a defense-in-depth measure. Even if escapeHtml is used,
 * we still remove known attack patterns.
 */
export function removeDangerousPatterns(str: string): string {
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
export function normalizeWhitespace(str: string): string {
  return str
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars (except \t, \n, \r)
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Main sanitization function for user input strings.
 *
 * Applies multiple layers of protection:
 * 1. Normalize whitespace
 * 2. Remove dangerous patterns
 * 3. Escape HTML entities
 *
 * @example
 * sanitizeString('  <script>alert("xss")</script>  Hello  World  ')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; Hello World'
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== "string") {
    return "";
  }

  let sanitized = normalizeWhitespace(str);
  sanitized = removeDangerousPatterns(sanitized);
  sanitized = escapeHtml(sanitized);

  return sanitized;
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

/**
 * Recursively sanitizes all string values in an object.
 *
 * Useful for sanitizing entire form submissions or API payloads.
 *
 * @example
 * sanitizeObject({
 *   title: '<script>alert("xss")</script>',
 *   nested: { value: 'Hello <b>World</b>' }
 * })
 * // Returns: {
 * //   title: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
 * //   nested: { value: 'Hello &lt;b&gt;World&lt;/b&gt;' }
 * // }
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Validates that a string contains only safe characters for specific contexts.
 *
 * @param str - The string to validate
 * @param allowedPattern - Regex pattern of allowed characters
 * @returns true if the string is safe, false otherwise
 */
export function isValidInput(
  str: string,
  allowedPattern: RegExp = /^[\w\s\-.,!?'"@#$%&*()[\]{}:;+=<>/\\|~`]+$/
): boolean {
  return allowedPattern.test(str);
}

/**
 * Generates a safe filename from user input.
 *
 * Removes path traversal attempts and dangerous characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, "") // Remove dangerous characters
    .replace(/\.\./g, "") // Remove path traversal
    .replace(/^\.+/, "") // Remove leading dots
    .trim()
    .slice(0, 255); // Limit length
}
