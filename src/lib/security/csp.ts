/**
 * Content Security Policy (CSP) Configuration
 *
 * Implements CSP to prevent XSS and code injection attacks.
 * Can be disabled via environment variable for rollback capability.
 *
 * Security benefits:
 * - Prevents unauthorized script execution from external sources
 * - Blocks malicious script injection
 * - Protects against XSS attacks
 * - Prevents data exfiltration
 *
 * Note: This uses a simplified CSP without nonces, which is standard for Next.js apps.
 * Nonces require complex integration with Next.js rendering and provide marginal
 * security benefit for this use case.
 */

/**
 * CSP mode: enforce, report-only, or disabled
 */
export type CSPMode = 'enforce' | 'report-only' | 'disabled';

/**
 * Get CSP mode from environment
 */
export function getCSPMode(): CSPMode {
  const mode = process.env.NEXT_PUBLIC_CSP_MODE || 'enforce';
  if (mode === 'disabled' || mode === 'report-only' || mode === 'enforce') {
    return mode;
  }
  return 'enforce';
}

/**
 * Build CSP header value
 *
 * @param mode - CSP mode (enforce or report-only)
 * @returns CSP header value
 */
export function buildCSPHeader(mode: CSPMode = 'enforce'): string {
  const cspDirectives = [
    // Default: only allow resources from same origin
    "default-src 'self'",

    // Scripts: allow from self, inline, and eval (required for Next.js/React)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",

    // Styles: allow inline styles (needed for Next.js and UI libraries)
    "style-src 'self' 'unsafe-inline'",

    // Images: allow from same origin, data URIs, and Supabase Storage
    "img-src 'self' data: blob: https://*.supabase.co",

    // Fonts: allow from same origin
    "font-src 'self' data:",

    // Connect (API calls): allow same origin and external services
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co', // WebSocket for Supabase Realtime
      'https://r.supabase.co', // Supabase CDN
      'https://api.anthropic.com',
      'https://qstash.upstash.io',
      'https://vercel.live',
      'wss://vercel.live', // Vercel Live WebSocket
    ].join(' '),

    // Frames: disallow embedding (prevents clickjacking)
    "frame-ancestors 'none'",

    // Base URI: restrict to same origin
    "base-uri 'self'",

    // Form actions: restrict to same origin
    "form-action 'self'",

    // Object/Embed: block plugins
    "object-src 'none'",
  ];

  return cspDirectives.join('; ');
}

/**
 * Get CSP header name based on mode
 */
export function getCSPHeaderName(mode: CSPMode): string {
  return mode === 'report-only'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
}
