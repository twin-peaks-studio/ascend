/**
 * Cross-Tab Synchronization Utility
 *
 * Provides instant same-browser tab synchronization using the BroadcastChannel API.
 * This complements Supabase Realtime by providing faster local sync (~50ms vs ~200ms).
 *
 * For older browsers without BroadcastChannel support, this gracefully degrades
 * to no-op (Supabase Realtime still provides synchronization).
 */

const CHANNEL_NAME = "timer-sync-local";

type SyncCallback = () => void;

class CrossTabSync {
  private channel: BroadcastChannel | null = null;
  private callbacks: Set<SyncCallback> = new Set();

  constructor() {
    if (typeof window === "undefined") return;

    // Check for BroadcastChannel support (96%+ of browsers as of 2025)
    if (!("BroadcastChannel" in window)) {
      console.log("[CrossTabSync] BroadcastChannel not supported, using Realtime only");
      return;
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = () => {
        // Notify all subscribers that timer state changed in another tab
        this.callbacks.forEach((callback) => {
          try {
            callback();
          } catch (error) {
            console.error("[CrossTabSync] Callback error:", error);
          }
        });
      };
    } catch (error) {
      // BroadcastChannel may fail in some contexts (e.g., file:// protocol)
      console.warn("[CrossTabSync] Failed to create channel:", error);
    }
  }

  /**
   * Broadcast a timer change to other tabs in the same browser.
   * Call this after a successful timer start/stop mutation.
   */
  broadcast(): void {
    try {
      this.channel?.postMessage({ type: "TIMER_CHANGED", timestamp: Date.now() });
    } catch {
      // Ignore errors (channel might be closed)
    }
  }

  /**
   * Subscribe to timer changes from other tabs.
   * The callback will be invoked when any other tab broadcasts a change.
   *
   * @returns Unsubscribe function
   */
  subscribe(callback: SyncCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Close the channel and clean up resources.
   * Generally not needed as channels are cleaned up on page unload.
   */
  destroy(): void {
    this.channel?.close();
    this.channel = null;
    this.callbacks.clear();
  }
}

// Export singleton instance
export const crossTabSync = new CrossTabSync();
