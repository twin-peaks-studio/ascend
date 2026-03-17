"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Circle,
  CheckCircle2,
  Sparkles,
  Loader2,
  RefreshCw,
  Package,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useTodayTasks } from "@/hooks/use-today-tasks";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useTaskEstimation, formatEstimate } from "@/hooks/use-task-estimation";
import { QuickAddTask } from "@/components/task";
import { ReschedulePopover } from "@/components/today/reschedule-popover";
import { DaySummaryBanner } from "@/components/today/day-summary-banner";
import { PRIORITY_CIRCLE_COLORS } from "@/components/task/task-list-view";
import { isOverdue } from "@/lib/date-utils";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { WorkspaceFilter } from "@/components/filters";
import type { TaskWithProject } from "@/types";
import type { CreateTaskInput } from "@/lib/validation";

export default function TodayPage() {
  const router = useRouter();
  const { groups, totalCount, overdueCount, loading } = useTodayTasks();
  const { updateTask, createTask, loading: mutationLoading } = useTaskMutations();
  const { projects } = useProjects();
  const { profiles } = useProfiles();
  const { user } = useAuth();
  const { workspaces } = useWorkspaceContext();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const handleWorkspacesChange = useCallback((ids: string[]) => {
    setSelectedWorkspaceIds(ids);
  }, []);
  const {
    estimateAll,
    estimateOne,
    getEstimate,
    daySummary,
    isLoading: estimating,
    isLoadingTaskId,
    hasEstimates,
    error: estimateError,
  } = useTaskEstimation();

  // Filter groups by workspace if filter is active
  const workspaceProjectIds = useMemo(() => {
    if (selectedWorkspaceIds.length === 0) return null;
    const ids = new Set<string>();
    for (const project of projects) {
      if (project.workspace_id && selectedWorkspaceIds.includes(project.workspace_id)) {
        ids.add(project.id);
      }
    }
    return ids;
  }, [selectedWorkspaceIds, projects]);

  const filteredGroups = useMemo(() => {
    if (!workspaceProjectIds) return groups;
    return groups
      .filter((g) => g.projectId && workspaceProjectIds.has(g.projectId))
      .map((g) => ({
        ...g,
        tasks: g.tasks.filter((t) => t.project_id && workspaceProjectIds.has(t.project_id)),
      }))
      .filter((g) => g.tasks.length > 0);
  }, [groups, workspaceProjectIds]);

  const allTasks = filteredGroups.flatMap((g) => g.tasks);
  const filteredTotalCount = allTasks.length;
  const filteredOverdueCount = allTasks.filter((t) => t.status !== "done" && t.due_date && isOverdue(t.due_date)).length;

  const handleStatusToggle = useCallback(
    async (task: TaskWithProject) => {
      const newStatus = task.status === "done" ? "todo" : "done";
      await updateTask(task.id, { status: newStatus });
    },
    [updateTask]
  );

  const handleReschedule = useCallback(
    async (task: TaskWithProject, newDate: Date) => {
      await updateTask(task.id, { due_date: newDate.toISOString() });
    },
    [updateTask]
  );

  const handleTaskClick = useCallback(
    (task: TaskWithProject) => {
      router.push(`/tasks/${task.id}`);
    },
    [router]
  );

  const handleQuickAddSubmit = useCallback(
    async (data: CreateTaskInput) => {
      await createTask(data);
    },
    [createTask]
  );

  const handleAddTask = useCallback(() => {
    setShowQuickAdd(true);
  }, []);

  const todayLabel = format(new Date(), "EEE, MMM d");

  return (
    <AppShell onAddTask={handleAddTask}>
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">Today</h1>
                <span className="text-sm text-muted-foreground">{todayLabel}</span>
                {filteredTotalCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {filteredTotalCount}
                  </span>
                )}
                {filteredOverdueCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {filteredOverdueCount} overdue
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {workspaces.length > 1 && (
                <WorkspaceFilter
                  workspaces={workspaces}
                  selectedWorkspaceIds={selectedWorkspaceIds}
                  onWorkspacesChange={handleWorkspacesChange}
                />
              )}

              {/* Estimate My Day button */}
              {filteredTotalCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => estimateAll(allTasks)}
                  disabled={estimating}
                  className="gap-2"
                >
                  {estimating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {hasEstimates ? "Re-estimate" : "Estimate My Day"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex-1">
          {/* Estimation error */}
          {estimateError && (
            <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {estimateError}
            </div>
          )}

          {/* Day Summary Banner */}
          {daySummary && <DaySummaryBanner summary={daySummary} />}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading tasks…</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredTotalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-lg font-medium mb-1">You&apos;re all caught up!</h2>
              <p className="text-sm text-muted-foreground">
                No tasks due today. Enjoy your day!
              </p>
            </div>
          )}

          {/* Task groups */}
          {!loading &&
            filteredGroups.map((group) => (
              <div key={group.projectId ?? "__no_project__"} className="mb-6">
                {/* Group header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.projectColor ? (
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.projectColor }}
                    />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.projectName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.tasks.length}
                  </span>
                </div>

                {/* Task list */}
                <div className="rounded-lg border bg-card">
                  {group.tasks.map((task) => (
                    <TodayTaskRow
                      key={task.id}
                      task={task}
                      estimate={getEstimate(task.id)}
                      isEstimating={isLoadingTaskId === task.id}
                      onStatusToggle={handleStatusToggle}
                      onReschedule={(date) => handleReschedule(task, date)}
                      onTaskClick={handleTaskClick}
                      onReestimate={() => estimateOne(task)}
                      showReestimate={hasEstimates}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Quick add task drawer (mobile) */}
      <QuickAddTask
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSubmit={handleQuickAddSubmit}
        projects={projects}
        profiles={profiles}
        loading={mutationLoading}
        defaultAssigneeId={user?.id ?? null}
      />
    </AppShell>
  );
}

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TodayTaskRowProps {
  task: TaskWithProject;
  estimate?: { estimatedMinutes: number; confidence: number };
  isEstimating: boolean;
  onStatusToggle: (task: TaskWithProject) => void;
  onReschedule: (date: Date) => void;
  onTaskClick: (task: TaskWithProject) => void;
  onReestimate: () => void;
  showReestimate: boolean;
}

function TodayTaskRow({
  task,
  estimate,
  isEstimating,
  onStatusToggle,
  onReschedule,
  onTaskClick,
  onReestimate,
  showReestimate,
}: TodayTaskRowProps) {
  const isCompleted = task.status === "done";
  const overdue = !isCompleted && task.due_date ? isOverdue(task.due_date) : false;
  const priorityColor =
    PRIORITY_CIRCLE_COLORS[task.priority] || PRIORITY_CIRCLE_COLORS.medium;

  return (
    <div
      onClick={() => onTaskClick(task)}
      className={cn(
        "group flex items-center gap-3 py-3 px-3 border-b border-border/40 last:border-0 cursor-pointer",
        "hover:bg-muted/30 transition-colors",
        isCompleted && "opacity-50"
      )}
    >
      {/* Status toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStatusToggle(task);
        }}
        className={cn("shrink-0 transition-colors", priorityColor)}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      {/* Title + badges */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {task.products && task.products.length > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Package className="h-2.5 w-2.5" />
              {task.products[0].name}
              {task.products.length > 1 && ` +${task.products.length - 1}`}
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Overdue
            </span>
          )}
          {estimate && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
              ~{formatEstimate(estimate.estimatedMinutes)}
            </span>
          )}
          {isEstimating && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              estimating…
            </span>
          )}
        </div>
      </div>

      {/* Right actions — only show on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Re-estimate individual task */}
        {showReestimate && !isCompleted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReestimate();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Re-estimate this task"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Reschedule */}
        {!isCompleted && (
          <ReschedulePopover onReschedule={onReschedule} />
        )}
      </div>
    </div>
  );
}
