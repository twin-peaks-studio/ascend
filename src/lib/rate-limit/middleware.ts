/**
 * Rate Limiting Middleware for API Routes
 *
 * Provides hybrid per-user + IP-based rate limiting for Next.js API routes.
 * Uses Redis-backed rate limiter for distributed rate limiting.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitConfigs } from "./limiter";
import { logger } from "@/lib/logger";

/**
 * Get client IP address from request
 * Handles various proxy headers (Vercel, Cloudflare, etc.)
 */
function getClientIp(request: NextRequest): string {
  // Try various headers in order of preference
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to localhost for development
  return "127.0.0.1";
}

export interface RateLimitResult {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  identifier?: string;
}

/**
 * Check rate limit for a request using hybrid user + IP limiting
 *
 * @param request - Next.js request object
 * @param userId - Optional authenticated user ID
 * @param limitType - Type of rate limit to apply (aiExtraction, emailSend, globalApi)
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkRequestRateLimit(
  request: NextRequest,
  userId: string | null,
  limitType: keyof typeof rateLimitConfigs
): Promise<RateLimitResult> {
  const config = rateLimitConfigs[limitType];
  const ip = getClientIp(request);

  // Primary identifier: user ID if authenticated, otherwise IP
  const primaryIdentifier = userId ? `user:${userId}` : `ip:${ip}`;
  const rateLimitKey = `${limitType}:${primaryIdentifier}`;

  try {
    const result = await checkRateLimit(rateLimitKey, config);

    if (!result.success) {
      logger.warn("Rate limit exceeded", {
        limitType,
        identifier: primaryIdentifier,
        ip,
        limit: result.limit,
        reset: result.reset,
      });

      return {
        allowed: false,
        limit: result.limit,
        remaining: 0,
        reset: result.reset,
        identifier: primaryIdentifier,
      };
    }

    return {
      allowed: true,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      identifier: primaryIdentifier,
    };
  } catch (error) {
    // If rate limiting fails (Redis down, etc.), allow the request but log the error
    logger.error("Rate limiting check failed - allowing request", {
      error: error instanceof Error ? error.message : "Unknown error",
      limitType,
      identifier: primaryIdentifier,
    });

    return {
      allowed: true,
    };
  }
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = result.reset
    ? Math.ceil((result.reset - Date.now()) / 1000)
    : 60;

  return NextResponse.json(
    {
      success: false,
      error: {
        type: "rate_limit",
        message: "Too many requests. Please try again later.",
        retryAfter,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": result.limit?.toString() || "",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.reset?.toString() || "",
      },
    }
  );
}

/**
 * Wrapper to easily apply rate limiting to API route handlers
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const user = await authenticate(request);
 *   const rateLimitCheck = await withRateLimit(request, user?.id, 'aiExtraction');
 *   if (!rateLimitCheck.allowed) {
 *     return createRateLimitResponse(rateLimitCheck);
 *   }
 *   // ... rest of handler
 * }
 */
export async function withRateLimit(
  request: NextRequest,
  userId: string | null,
  limitType: keyof typeof rateLimitConfigs
): Promise<RateLimitResult> {
  return checkRequestRateLimit(request, userId, limitType);
}
