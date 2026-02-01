"use client";

import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useState, useCallback, useEffect } from "react";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  onAddTask?: () => void;
}

export function AppShell({ children, onAddTask }: AppShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { isCollapsed } = useSidebar();

  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  // Global keyboard shortcut for showing help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts dialog on "?"
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Also support Cmd/Ctrl + /
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onShowShortcuts={handleShowShortcuts} />

      {/* Main content area - offset by sidebar width on desktop (lg), no offset on tablet and below */}
      <main
        className={cn(
          "transition-all duration-300",
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <div className="min-h-screen pb-24 lg:pb-0">{children}</div>
      </main>

      {/* Mobile/Tablet bottom navigation (visible below lg breakpoint) */}
      <MobileBottomNav onAddTask={onAddTask} />

      {/* Shortcuts dialog */}
      <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}
