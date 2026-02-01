import type { NextConfig } from "next";

/**
 * Security headers for the application
 *
 * These headers protect against:
 * - XSS attacks (Content-Security-Policy)
 * - MIME sniffing (X-Content-Type-Options)
 * - Clickjacking (X-Frame-Options)
 * - Info leakage (Referrer-Policy)
 * - Unnecessary features (Permissions-Policy)
 */
const securityHeaders = [
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
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  /**
   * Apply security headers to all routes
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  /**
   * Strict mode for better React behavior
   */
  reactStrictMode: true,

  /**
   * Image optimization config
   * Add domains here if loading external images
   */
  images: {
    remotePatterns: [
      // Add external image domains here if needed
      // Example:
      // {
      //   protocol: 'https',
      //   hostname: 'example.com',
      // },
    ],
  },
};

export default nextConfig;
