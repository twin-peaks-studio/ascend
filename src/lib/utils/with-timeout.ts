/**
 * Timeout Utilities
 *
 * Provides timeout wrappers for async operations to prevent hanging requests,
 * especially important for mobile backgrounding scenarios where connections
 * can become stale.
 */

/**
 * Timeout constants for different operation types (in milliseconds)
 */
export const TIMEOUTS = {
  /** Quick connectivity test */
  HEALTH_CHECK: 3000,
  /** Auth session operations */
  AUTH_SESSION: 5000,
  /** Auth refresh operations (slightly longer) */
  AUTH_REFRESH: 8000,
  /** Data fetch queries */
  DATA_QUERY: 10000,
  /** Mutation operations (more critical, allow more time) */
  MUTATION: 15000,
  /** Minimum background duration to trigger recovery */
  MIN_BACKGROUND: 500,
  /** Debounce visibility changes */
  DEBOUNCE: 100,
} as const;

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within the specified time, it rejects with a TimeoutError.
 *
 * @param promise - The promise to wrap
 * @param ms - Timeout duration in milliseconds
 * @param errorMessage - Optional custom error message
 * @returns The resolved value of the promise
 * @throws TimeoutError if the timeout is exceeded
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   supabase.auth.getSession(),
 *   TIMEOUTS.AUTH_SESSION
 * );
 * ```
 */
export async function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T>,
  ms: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  // Convert PromiseLike to Promise
  const promise = Promise.resolve(promiseOrThenable);

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          errorMessage || `Operation timed out after ${ms}ms`,
          ms
        )
      );
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Wraps an async function with timeout and AbortController support.
 * The function receives an AbortSignal that will be aborted on timeout.
 *
 * @param fn - Async function that accepts an AbortSignal
 * @param ms - Timeout duration in milliseconds
 * @param errorMessage - Optional custom error message
 * @returns The resolved value of the function
 *
 * @example
 * ```typescript
 * const result = await withTimeoutAndAbort(
 *   async (signal) => {
 *     const response = await fetch(url, { signal });
 *     return response.json();
 *   },
 *   TIMEOUTS.DATA_QUERY
 * );
 * ```
 */
export async function withTimeoutAndAbort<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  errorMessage?: string
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new TimeoutError(
          errorMessage || `Operation timed out after ${ms}ms`,
          ms
        )
      );
    }, ms);
  });

  try {
    const result = await Promise.race([fn(controller.signal), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Type guard to check if an error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelayMs - Base delay between retries (will be multiplied exponentially)
 * @returns The resolved value of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
