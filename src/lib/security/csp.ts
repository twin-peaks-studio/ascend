/**
 * Content Security Policy (CSP) Configuration
 *
 * Implements nonce-based CSP to prevent XSS and code injection attacks.
 * Can be disabled via environment variable for rollback capability.
 *
 * Security benefits:
 * - Prevents unauthorized script execution
 * - Blocks inline scripts without nonces
 * - Protects against XSS attacks
 * - Prevents data exfiltration
 */

import { nanoid } from 'nanoid';

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
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  return nanoid(32);
}

/**
 * Build CSP header value with nonce
 *
 * @param nonce - Unique nonce for this request
 * @param mode - CSP mode (enforce or report-only)
 * @returns CSP header value
 */
export function buildCSPHeader(nonce: string, mode: CSPMode = 'enforce'): string {
  const cspDirectives = [
    // Default: only allow resources from same origin
    "default-src 'self'",

    // Scripts: allow from self, with nonce, and eval (needed for Next.js/React)
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://vercel.live`,

    // Styles: allow nonces and inline styles (needed for some UI libraries)
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,

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

    // Frames: disallow embedding
    "frame-ancestors 'none'",

    // Base URI: restrict to same origin
    "base-uri 'self'",

    // Form actions: restrict to same origin
    "form-action 'self'",

    // Upgrade insecure requests (HTTP -> HTTPS)
    'upgrade-insecure-requests',
  ];

  // Add report-uri for monitoring (optional - configure when you have an endpoint)
  // if (process.env.CSP_REPORT_URI) {
  //   cspDirectives.push(`report-uri ${process.env.CSP_REPORT_URI}`);
  // }

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
