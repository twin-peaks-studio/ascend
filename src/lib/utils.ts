import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Default timeout for data fetching operations (5 seconds)
 */
export const DATA_FETCH_TIMEOUT_MS = 5000;

/**
 * Wraps a promise (or thenable like Supabase queries) with a timeout.
 * If it doesn't resolve within the specified time, it rejects with a timeout error.
 * This prevents hanging on stale connections (e.g., after mobile app backgrounding).
 */
export function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T>,
  ms: number = DATA_FETCH_TIMEOUT_MS
): Promise<T> {
  // Convert thenable to proper Promise
  const promise = Promise.resolve(promiseOrThenable);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
