"use client";

import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useState, useCallback, useEffect, useLayoutEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { SearchDialog } from "../search";
import { AuthDialog } from "../auth";
import { FeedbackDialog } from "../feedback-dialog";
import { ConversationalTaskModal } from "../ai";
import { QuickCaptureModal } from "../task/quick-capture-modal";

import { TimerProvider, useTimerContext } from "@/contexts/timer-context";
import { useSidebar } from "@/hooks/use-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRecoveryState } from "@/hooks/use-recovery";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./header";
import type { Profile, Project, TaskWithProject } from "@/types";
import type { TaskSortField, TaskSortDirection } from "@/lib/task-sort";

// Context for search dialog trigger
const SearchContext = createContext<{ openSearch: () => void } | null>(null);
export const useSearchDialog = () => {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useSearchDialog must be used within AppShell");
  return context;
};

// Context for feedback dialog trigger
const FeedbackContext = createContext<{ openFeedback: () => void } | null>(null);
export const useFeedbackDialog = () => {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedbackDialog must be used within AppShell");
  return context;
};

// Context for quick task capture
const QuickCaptureContext = createContext<{ openQuickCapture: () => void } | null>(null);
export const useQuickCapture = () => {
  const context = useContext(QuickCaptureContext);
  if (!context) throw new Error("useQuickCapture must be used within AppShell");
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
  if (!context) throw new Error("useTheme must be used within AppShell");
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
  assigneeProfiles?: Profile[];
  assigneeTasks?: TaskWithProject[];
  selectedAssigneeIds?: string[];
  onAssigneesChange?: (assigneeIds: string[]) => void;
  currentUserId?: string | null;
  disableZeroCount?: boolean;
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
}

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
  viewMode,
  onViewModeChange,
  projects,
  selectedProjectIds,
  onProjectsChange,
  sortField,
  sortDirection,
  onSortChange,
  assigneeProfiles,
  assigneeTasks,
  selectedAssigneeIds,
  onAssigneesChange,
  currentUserId,
  disableZeroCount,
  showCompleted,
  onShowCompletedChange,
}: AppShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAiCreate, setShowAiCreate] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const { isCollapsed } = useSidebar();
  const { user, initialized, confidence } = useAuth();
  const { isRefreshing } = useRecoveryState();

  const openQuickCapture = useCallback(() => setShowQuickCapture(true), []);

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
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
      if (prefersDark) document.documentElement.classList.add("dark");
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

  useEffect(() => {
    const shouldShowAuth =
      initialized && !user && confidence === "confirmed" && !isRefreshing;
    if (shouldShowAuth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAuthDialog(true);
    } else if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAuthDialog(false);
    }
  }, [initialized, user, confidence, isRefreshing]);

  const handleOpenSearch = useCallback(() => setShowSearch(true), []);
  const handleOpenFeedback = useCallback(() => setShowFeedback(true), []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement;

      if (e.key === "k" && (e.ctrlKey || e.metaKey) && !isInput) {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === "7" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowQuickCapture(true);
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
    <QuickCaptureContext.Provider value={{ openQuickCapture }}>
      <div className="min-h-screen bg-background">
        <Sidebar onShowFeedback={handleOpenFeedback} onAiCreate={() => setShowAiCreate(true)} />

        <main className={cn("transition-all duration-300", isCollapsed ? "lg:pl-16" : "lg:pl-64")}>
          <div className="min-h-screen pb-24 lg:pb-0">{children}</div>
        </main>

        <MobileBottomNav
          onAddTask={openQuickCapture}
          onAiCreate={() => setShowAiCreate(true)}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          projects={projects}
          selectedProjectIds={selectedProjectIds}
          onProjectsChange={onProjectsChange}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          assigneeProfiles={assigneeProfiles}
          assigneeTasks={assigneeTasks}
          selectedAssigneeIds={selectedAssigneeIds}
          onAssigneesChange={onAssigneesChange}
          currentUserId={currentUserId}
          disableZeroCount={disableZeroCount}
          showCompleted={showCompleted}
          onShowCompletedChange={onShowCompletedChange}
        />

        <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
        <SearchDialog open={showSearch} onOpenChange={setShowSearch} />
        <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} preventClose={!user} />
        <FeedbackDialog open={showFeedback} onOpenChange={setShowFeedback} />

        {/* AI multi-task creation — sidebar + mobile nav sparkles button */}
        <ConversationalTaskModal open={showAiCreate} onOpenChange={setShowAiCreate} />

        {/* Quick capture — Cmd+7, header button, mobile FAB */}
        <QuickCaptureModal open={showQuickCapture} onOpenChange={setShowQuickCapture} />

        <TimerTaskNavigation />
      </div>
    </QuickCaptureContext.Provider>
    </FeedbackContext.Provider>
    </SearchContext.Provider>
    </ThemeContext.Provider>
    </TimerProvider>
  );
}
