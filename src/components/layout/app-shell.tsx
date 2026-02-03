"use client";

import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { SearchDialog } from "../search";
import { AuthDialog } from "../auth";
import { FeedbackDialog } from "../feedback-dialog";
import { TimerProvider, useTimerContext } from "@/contexts/timer-context";
import { useSidebar } from "@/hooks/use-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRecoveryState } from "@/hooks/use-recovery";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useProjects } from "@/hooks/use-projects";
import { TaskDetailsResponsive } from "@/components/task/task-details-responsive";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./header";
import type { Project, TaskWithProject } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";

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

interface AppShellProps {
  children: React.ReactNode;
  onAddTask?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  projects?: Project[];
  selectedProjectIds?: string[];
  onProjectsChange?: (projectIds: string[]) => void;
}

/**
 * Inner component that handles opening task details from the global timer indicator.
 * This needs to be inside the TimerProvider to access setOnOpenTask.
 */
function TimerTaskDialog() {
  const { setOnOpenTask } = useTimerContext();
  const { tasks } = useTasks();
  const { updateTask } = useTaskMutations();
  const { profiles } = useProfiles();
  const { projects } = useProjects();

  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Use ref to access current tasks without causing effect re-runs
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Register the callback to open task dialog from timer indicator (runs once)
  useEffect(() => {
    setOnOpenTask((taskId: string) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setShowTaskDialog(true);
      }
    });
  }, [setOnOpenTask]);

  const handleUpdateTask = async (data: UpdateTaskInput) => {
    if (!selectedTask) return;
    setIsUpdating(true);
    try {
      await updateTask(selectedTask.id, data);
      // Update the local selected task with new data
      setSelectedTask((prev) =>
        prev ? { ...prev, ...data } : null
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <TaskDetailsResponsive
      task={selectedTask}
      open={showTaskDialog}
      onOpenChange={setShowTaskDialog}
      onUpdate={handleUpdateTask}
      profiles={profiles}
      projects={projects}
      loading={isUpdating}
    />
  );
}

export function AppShell({
  children,
  onAddTask,
  viewMode,
  onViewModeChange,
  projects,
  selectedProjectIds,
  onProjectsChange,
}: AppShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { isCollapsed } = useSidebar();
  const { user, initialized, confidence } = useAuth();
  const { isRefreshing } = useRecoveryState();

  // Show auth dialog ONLY when we're confident the user is logged out
  // Don't show during refresh or when auth state is uncertain (cached/unknown)
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
      setShowAuthDialog(true);
    } else if (user) {
      setShowAuthDialog(false);
    }
  }, [initialized, user, confidence, isRefreshing]);

  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setShowFeedback(true);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    <TimerProvider>
    <SearchContext.Provider value={{ openSearch: handleOpenSearch }}>
      <FeedbackContext.Provider value={{ openFeedback: handleOpenFeedback }}>
      <div className="min-h-screen bg-background">
        <Sidebar onShowShortcuts={handleShowShortcuts} onShowFeedback={handleOpenFeedback} />

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
        <TimerTaskDialog />
      </div>
      </FeedbackContext.Provider>
    </SearchContext.Provider>
    </TimerProvider>
  );
}
