"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to media query changes
 */
function subscribe(query: string, callback: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/**
 * Get the current snapshot of whether the media query matches
 */
function getSnapshot(query: string): boolean {
  return window.matchMedia(query).matches;
}

/**
 * Server snapshot - always return false to avoid hydration mismatch
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Hook to detect if a media query matches
 */
export function useMediaQuery(query: string): boolean {
  const matches = useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getSnapshot(query),
    getServerSnapshot
  );

  return matches;
}

/**
 * Hook to detect if the device is mobile (screen width < 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
