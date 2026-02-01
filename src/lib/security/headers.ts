/**
 * Security Headers Configuration
 *
 * Enterprise-grade security headers to protect against common web vulnerabilities.
 *
 * SECURITY HEADERS EXPLAINED:
 *
 * 1. Content-Security-Policy (CSP):
 *    - Controls what resources can be loaded
 *    - Prevents XSS attacks by blocking inline scripts
 *    - Restricts where data can be sent
 *
 * 2. X-Content-Type-Options:
 *    - Prevents MIME type sniffing
 *    - Ensures browser respects declared content type
 *
 * 3. X-Frame-Options:
 *    - Prevents clickjacking attacks
 *    - Controls if page can be embedded in iframes
 *
 * 4. X-XSS-Protection:
 *    - Enables browser's XSS filter (legacy browsers)
 *    - Modern browsers rely more on CSP
 *
 * 5. Referrer-Policy:
 *    - Controls what referrer info is sent
 *    - Prevents leaking sensitive URL data
 *
 * 6. Permissions-Policy:
 *    - Controls browser features
 *    - Disables unnecessary APIs to reduce attack surface
 *
 * 7. Strict-Transport-Security (HSTS):
 *    - Forces HTTPS connections
 *    - Protects against protocol downgrade attacks
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Get Supabase project URL for CSP
 */
function getSupabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      return "*.supabase.co";
    }
  }
  return "*.supabase.co";
}

/**
 * Content Security Policy directives
 *
 * This is intentionally strict. Adjust as needed for your use case.
 */
export function getCSPDirectives(): string {
  const supabaseHost = getSupabaseHost();

  const directives = [
    // Default: only allow same-origin
    "default-src 'self'",

    // Scripts: self + Next.js inline scripts
    // Note: 'unsafe-inline' needed for Next.js, use nonce-based CSP in production
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

    // Styles: self + inline (for Tailwind)
    "style-src 'self' 'unsafe-inline'",

    // Images: self + data URIs + HTTPS
    "img-src 'self' data: https:",

    // Fonts: self + Google Fonts
    "font-src 'self' https://fonts.gstatic.com",

    // Connect: self + Supabase
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,

    // Frames: none (prevent embedding)
    "frame-src 'none'",

    // Objects: none (no Flash, etc.)
    "object-src 'none'",

    // Base URI: self only
    "base-uri 'self'",

    // Form actions: self only
    "form-action 'self'",

    // Frame ancestors: none (prevent clickjacking)
    "frame-ancestors 'none'",

    // Upgrade insecure requests
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

/**
 * All security headers to apply
 */
export function getSecurityHeaders(): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: getCSPDirectives(),
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-XSS-Protection",
      value: "1; mode=block",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "magnetometer=()",
        "gyroscope=()",
        "accelerometer=()",
      ].join(", "),
    },
    // Only enable HSTS in production
    ...(process.env.NODE_ENV === "production"
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ]
      : []),
  ];
}

/**
 * Headers formatted for Next.js config
 */
export function getNextSecurityHeaders() {
  return getSecurityHeaders().map((header) => ({
    key: header.key,
    value: header.value,
  }));
}
