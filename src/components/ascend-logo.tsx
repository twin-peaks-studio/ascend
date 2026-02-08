"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AscendLogoProps {
  className?: string;
  /** Force a variant; if omitted, follows document dark/light theme */
  variant?: "light" | "dark";
}

/**
 * Ascend logo - sun and mountains (Andes / Tatras).
 * Follows app theme by default; pass variant to force light or dark.
 */
export function AscendLogo({ className, variant }: AscendLogoProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Valid use of setState in effect: client-side hydration pattern
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const useDark =
    variant === "dark" || (variant === undefined && mounted && isDark);
  return useDark ? (
    <AscendLogoDark className={className} />
  ) : (
    <AscendLogoLight className={className} />
  );
}

function AscendLogoLight({ className }: { className?: string }) {
  return (
    <svg
      width="512"
      height="256"
      viewBox="0 0 512 256"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="256" cy="92" r="40" fill="#F4A340" />
      <g stroke="#F4A340" strokeWidth="6" strokeLinecap="round">
        <line x1="256" y1="28" x2="256" y2="48" />
        <line x1="220" y1="36" x2="234" y2="58" />
        <line x1="292" y1="36" x2="278" y2="58" />
        <line x1="196" y1="58" x2="220" y2="72" />
        <line x1="316" y1="58" x2="292" y2="72" />
      </g>
      <path d="M64 192 L192 64 L320 192 Z" fill="#B53A2A" />
      <path d="M192 192 L320 64 L448 192 Z" fill="#2F5C8F" />
      <path d="M192 64 L168 92 L192 88 L216 92 Z" fill="#FFFFFF" />
      <path d="M320 64 L296 92 L320 88 L344 92 Z" fill="#FFFFFF" />
    </svg>
  );
}

function AscendLogoDark({ className }: { className?: string }) {
  return (
    <svg
      width="512"
      height="256"
      viewBox="0 0 512 256"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="256" cy="92" r="40" fill="#E39A3B" />
      <g stroke="#E39A3B" strokeWidth="6" strokeLinecap="round">
        <line x1="256" y1="28" x2="256" y2="48" />
        <line x1="220" y1="36" x2="234" y2="58" />
        <line x1="292" y1="36" x2="278" y2="58" />
        <line x1="196" y1="58" x2="220" y2="72" />
        <line x1="316" y1="58" x2="292" y2="72" />
      </g>
      <path d="M64 192 L192 64 L320 192 Z" fill="#8E2F24" />
      <path d="M192 192 L320 64 L448 192 Z" fill="#344E73" />
      <path d="M192 64 L168 92 L192 88 L216 92 Z" fill="#F2F2F2" />
      <path d="M320 64 L296 92 L320 88 L344 92 Z" fill="#F2F2F2" />
    </svg>
  );
}
