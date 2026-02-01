"use client";

import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { SearchDialog } from "../search";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./header";

// Context for search dialog trigger
const SearchContext = createContext<{ openSearch: () => void } | null>(null);
export const useSearchDialog = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchDialog must be used within AppShell");
  }
  return context;
};

interface AppShellProps {
  children: React.ReactNode;
  onAddTask?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function AppShell({ children, onAddTask, viewMode, onViewModeChange }: AppShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { isCollapsed } = useSidebar();

  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts dialog on "?"
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Also support Cmd/Ctrl + / for shortcuts
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Cmd/Ctrl + K to open search (if not already in input)
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        const activeEl = document.activeElement;
        const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
        if (!isInput) {
          e.preventDefault();
          setShowSearch(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SearchContext.Provider value={{ openSearch: handleOpenSearch }}>
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
        <MobileBottomNav
          onAddTask={onAddTask}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />

        {/* Shortcuts dialog */}
        <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

        {/* Search dialog */}
        <SearchDialog open={showSearch} onOpenChange={setShowSearch} />
      </div>
    </SearchContext.Provider>
  );
}
