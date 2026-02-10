"use client";

import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useState, useCallback, useEffect, useLayoutEffect, useRef, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { SearchDialog } from "../search";
import { AuthDialog } from "../auth";
import { FeedbackDialog } from "../feedback-dialog";
import { TimerProvider, useTimerContext } from "@/contexts/timer-context";
import { useSidebar } from "@/hooks/use-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRecoveryState } from "@/hooks/use-recovery";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./header";
import type { Project } from "@/types";
import type { TaskSortField, TaskSortDirection } from "@/lib/task-sort";

// Context for search dialog trigger
const SearchContext = createContext<{ openSearch: () => void } | null>(null);
export const useSearchDialog = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchDialog must be used within AppShell");
  }
  return context;
};

// Context for feedback dialog trigger
const FeedbackContext = createContext<{ openFeedback: () => void } | null>(null);
export const useFeedbackDialog = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedbackDialog must be used within AppShell");
  }
  return context;
};

// Context for theme state
const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
  mounted: boolean;
} | null>(null);
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within AppShell");
  }
  return context;
};

// Use useLayoutEffect on client, useEffect on server (SSR safe)
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface AppShellProps {
  children: React.ReactNode;
  onAddTask?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  projects?: Project[];
  selectedProjectIds?: string[];
  onProjectsChange?: (projectIds: string[]) => void;
  sortField?: TaskSortField;
  sortDirection?: TaskSortDirection;
  onSortChange?: (field: TaskSortField, direction: TaskSortDirection) => void;
}

/**
 * Inner component that handles opening task details from the global timer indicator.
 * Navigates to /tasks/[id] instead of opening a dialog, keeping one single task detail surface.
 */
function TimerTaskNavigation() {
  const { setOnOpenTask } = useTimerContext();
  const router = useRouter();

  useEffect(() => {
    setOnOpenTask((taskId: string) => {
      router.push(`/tasks/${taskId}`);
    });
  }, [setOnOpenTask, router]);

  return null;
}

export function AppShell({
  children,
  onAddTask,
  viewMode,
  onViewModeChange,
  projects,
  selectedProjectIds,
  onProjectsChange,
  sortField,
  sortDirection,
  onSortChange,
}: AppShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const { isCollapsed } = useSidebar();
  const { user, initialized, confidence } = useAuth();
  const { isRefreshing } = useRecoveryState();

  // Initialize theme from localStorage or system preference
  useIsomorphicLayoutEffect(() => {
    setThemeMounted(true);
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      // Use system preference
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDark(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      if (newIsDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return newIsDark;
    });
  }, []);

  // Show auth dialog ONLY when we're confident the user is logged out
  // Don't show during refresh or when auth state is uncertain (cached/unknown)
  // Valid use: syncing UI state with auth state (external system)
  useEffect(() => {
    // Only show login modal when:
    // 1. Auth is initialized
    // 2. No user exists
    // 3. Confidence is "confirmed" (not just a timeout/cached state)
    // 4. Not currently refreshing after backgrounding
    const shouldShowAuth =
      initialized &&
      !user &&
      confidence === "confirmed" &&
      !isRefreshing;

    if (shouldShowAuth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAuthDialog(true);
    } else if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAuthDialog(false);
    }
  }, [initialized, user, confidence, isRefreshing]);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setShowFeedback(true);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      // Cmd/Ctrl + K to open search (if not already in input)
      if (e.key === "k" && (e.ctrlKey || e.metaKey) && !isInput) {
        e.preventDefault();
        setShowSearch(true);
      }

      // Cmd/Ctrl + / or ? to open shortcuts dialog
      if (
        (e.key === "/" && (e.ctrlKey || e.metaKey)) ||
        (e.key === "?" && !isInput)
      ) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TimerProvider>
    <ThemeContext.Provider value={{ isDark, toggleTheme, mounted: themeMounted }}>
    <SearchContext.Provider value={{ openSearch: handleOpenSearch }}>
      <FeedbackContext.Provider value={{ openFeedback: handleOpenFeedback }}>
      <div className="min-h-screen bg-background">
        <Sidebar onShowFeedback={handleOpenFeedback} />

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
          projects={projects}
          selectedProjectIds={selectedProjectIds}
          onProjectsChange={onProjectsChange}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
        />

        {/* Shortcuts dialog */}
        <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

        {/* Search dialog */}
        <SearchDialog open={showSearch} onOpenChange={setShowSearch} />

        {/* Auth dialog - shown when user is not logged in and cannot be closed */}
        <AuthDialog
          open={showAuthDialog}
          onOpenChange={setShowAuthDialog}
          preventClose={!user}
        />

        {/* Feedback dialog */}
        <FeedbackDialog open={showFeedback} onOpenChange={setShowFeedback} />

        {/* Task dialog for timer indicator clicks */}
        <TimerTaskNavigation />
      </div>
      </FeedbackContext.Provider>
    </SearchContext.Provider>
    </ThemeContext.Provider>
    </TimerProvider>
  );
}
