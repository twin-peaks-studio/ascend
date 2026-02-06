/**
 * Rate Limiter
 *
 * Redis-backed rate limiting using Upstash.
 * Prevents abuse and controls costs (especially for AI endpoints).
 *
 * Usage:
 *   import { rateLimit } from '@/lib/rate-limit/limiter';
 *   const result = await rateLimit.check(`ai:${userId}`, { requests: 5, window: 60 });
 *   if (!result.success) {
 *     return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
 *   }
 */

import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface RateLimitConfig {
  requests: number; // Number of requests allowed
  window: number; // Time window in seconds
}

interface RateLimitResult {
  success: boolean; // Whether request is allowed
  limit: number; // Max requests allowed
  remaining: number; // Requests remaining in window
  reset: number; // Unix timestamp when window resets
}

/**
 * Check rate limit for a given key
 *
 * @param key - Unique identifier (e.g., `ai:${userId}`, `api:${ip}`)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
async function check(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowMs = config.window * 1000;
    const windowStart = now - windowMs;

    // Redis key for this rate limit
    const redisKey = `ratelimit:${key}`;

    // Use Redis sorted set to track requests by timestamp
    // Remove old requests outside the window
    await redis.zremrangebyscore(redisKey, 0, windowStart);

    // Count requests in current window
    const requestCount = await redis.zcard(redisKey);

    // Calculate reset time (end of current window)
    const oldestRequest = await redis.zrange(redisKey, 0, 0, {
      withScores: true,
    });
    const oldestTimestamp =
      oldestRequest.length > 0 ? Number(oldestRequest[0]) : now;
    const resetTime = oldestTimestamp + windowMs;

    // Check if limit exceeded
    if (requestCount >= config.requests) {
      logger.warn('Rate limit exceeded', {
        key,
        requestCount,
        limit: config.requests,
      });

      return {
        success: false,
        limit: config.requests,
        remaining: 0,
        reset: Math.ceil(resetTime / 1000),
      };
    }

    // Add current request to sorted set
    await redis.zadd(redisKey, { score: now, member: `${now}` });

    // Set expiration on key (cleanup)
    await redis.expire(redisKey, config.window * 2);

    // Calculate remaining requests
    const remaining = config.requests - (requestCount + 1);

    return {
      success: true,
      limit: config.requests,
      remaining,
      reset: Math.ceil(resetTime / 1000),
    };
  } catch (error) {
    // On Redis error, fail open (allow request) to avoid blocking users
    logger.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : String(error),
      key,
    });

    return {
      success: true,
      limit: config.requests,
      remaining: config.requests,
      reset: Math.ceil(Date.now() / 1000) + config.window,
    };
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  // AI extraction endpoint: 5 requests per minute (expensive operation)
  aiExtraction: { requests: 5, window: 60 },

  // Email sending: 5 requests per minute
  emailSend: { requests: 5, window: 60 },

  // Global API: 100 requests per minute
  globalApi: { requests: 100, window: 60 },

  // Auth attempts: 5 requests per 5 minutes
  auth: { requests: 5, window: 300 },
} as const;

export const rateLimit = {
  check,
  configs: rateLimitConfigs,
};
