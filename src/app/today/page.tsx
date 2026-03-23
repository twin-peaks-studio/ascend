"use client";

import { useCallback, useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  Circle,
  CheckCircle2,
  Sparkles,
  Loader2,
  RefreshCw,
  Package,
  Rocket,
  User,
  Brain,
  X,
} from "lucide-react";
import { ENTITY_TYPE_COLORS } from "@/lib/utils/entity-colors";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useTodayTasks } from "@/hooks/use-today-tasks";
import { useWeekTasks } from "@/hooks/use-week-tasks";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useTaskEstimation, formatEstimate } from "@/hooks/use-task-estimation";
import { useWeeklySummary, type SuggestedTask } from "@/hooks/use-weekly-summary";
import { QuickAddTask } from "@/components/task";
import { ReschedulePopover } from "@/components/today/reschedule-popover";
import { DaySummaryBanner } from "@/components/today/day-summary-banner";
import { WeeklySummaryBanner } from "@/components/today/weekly-summary-banner";
import { PRIORITY_CIRCLE_COLORS } from "@/components/task/task-list-view";
import { isOverdue } from "@/lib/date-utils";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { WorkspaceFilter } from "@/components/filters";
import type { TaskWithProject } from "@/types";
import type { CreateTaskInput } from "@/lib/validation";

type ViewMode = "today" | "week";

export default function TodayPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem("today-view-mode") as ViewMode) ?? "today";
    } catch {
      return "today";
    }
  });

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem("today-view-mode", mode); } catch { /* ignore */ }
  }, []);

  const { groups: todayGroups, totalCount: todayCount, overdueCount: todayOverdueCount, loading: todayLoading } = useTodayTasks();
  const { dayGroups: weekDayGroups, totalCount: weekCount, overdueCount: weekOverdueCount, loading: weekLoading } = useWeekTasks();

  const { updateTask, createTask, loading: mutationLoading } = useTaskMutations();
  const { projects } = useProjects();
  const { profiles } = useProfiles();
  const { user } = useAuth();
  const { workspaces, activeWorkspace } = useWorkspaceContext();

  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [summaryWorkspaceId, setSummaryWorkspaceId] = useState<string>(() => "");

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

  const { summary: weeklySummary, isLoading: summaryLoading, error: summaryError, generate: generateSummary } = useWeeklySummary();
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());

  const handleDismissSuggestion = useCallback((id: string) => {
    setDismissedSuggestionIds((prev) => new Set(prev).add(id));
  }, []);

  const handleScheduleSuggestion = useCallback(
    async (task: SuggestedTask, newDate: Date) => {
      await updateTask(task.id, { due_date: newDate.toISOString() });
      setDismissedSuggestionIds((prev) => new Set(prev).add(task.id));
    },
    [updateTask]
  );

  const visibleSuggestions = useMemo(() => {
    if (!weeklySummary?.suggestions) return [];
    return weeklySummary.suggestions.filter((s) => !dismissedSuggestionIds.has(s.id));
  }, [weeklySummary, dismissedSuggestionIds]);

  // Derive workspace for weekly summary (default to active workspace)
  const effectiveSummaryWorkspaceId = summaryWorkspaceId || activeWorkspace?.id || workspaces[0]?.id || "";

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

  const filteredTodayGroups = useMemo(() => {
    if (!workspaceProjectIds) return todayGroups;
    return todayGroups
      .filter((g) => g.projectId && workspaceProjectIds.has(g.projectId))
      .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.project_id && workspaceProjectIds.has(t.project_id)) }))
      .filter((g) => g.tasks.length > 0);
  }, [todayGroups, workspaceProjectIds]);

  const filteredWeekDayGroups = useMemo(() => {
    if (!workspaceProjectIds) return weekDayGroups;
    return weekDayGroups
      .map((dayGroup) => {
        const filteredProjectGroups = dayGroup.projectGroups
          .filter((pg) => pg.projectId === null || workspaceProjectIds.has(pg.projectId))
          .map((pg) => ({ ...pg, tasks: pg.tasks.filter((t) => !t.project_id || workspaceProjectIds.has(t.project_id)) }))
          .filter((pg) => pg.tasks.length > 0);
        const totalCount = filteredProjectGroups.reduce((s, pg) => s + pg.tasks.length, 0);
        return { ...dayGroup, projectGroups: filteredProjectGroups, totalCount };
      })
      .filter((dayGroup) => dayGroup.totalCount > 0);
  }, [weekDayGroups, workspaceProjectIds]);

  const activeTotalCount = viewMode === "today"
    ? filteredTodayGroups.flatMap((g) => g.tasks).length
    : filteredWeekDayGroups.reduce((s, dg) => s + dg.totalCount, 0);
  const activeOverdueCount = viewMode === "today"
    ? filteredTodayGroups.flatMap((g) => g.tasks).filter((t) => t.status !== "done" && t.due_date && isOverdue(t.due_date)).length
    : filteredWeekDayGroups.find((dg) => dg.isOverdue)?.totalCount ?? 0;
  const loading = viewMode === "today" ? todayLoading : weekLoading;

  const allTodayTasks = filteredTodayGroups.flatMap((g) => g.tasks);

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

  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const todayLabel = format(new Date(), "EEE, MMM d");
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`;

  return (
    <AppShell onAddTask={handleAddTask}>
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="max-w-2xl mx-auto px-4 pt-4 pb-3 space-y-2">
            {/* Row 1: toggle + date + counts */}
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-md border bg-muted p-0.5 text-sm">
                <button
                  onClick={() => handleViewModeChange("today")}
                  className={cn(
                    "px-3 py-1 rounded-sm transition-colors font-medium",
                    viewMode === "today"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Today
                </button>
                <button
                  onClick={() => handleViewModeChange("week")}
                  className={cn(
                    "px-3 py-1 rounded-sm transition-colors font-medium",
                    viewMode === "week"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Week
                </button>
              </div>

              <span className="text-sm text-muted-foreground">
                {viewMode === "today" ? todayLabel : weekLabel}
              </span>

              {activeTotalCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {activeTotalCount}
                </span>
              )}
              {activeOverdueCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {activeOverdueCount} overdue
                </span>
              )}
            </div>

            {/* Row 2: filters + actions */}
            <div className="flex items-center gap-2">
              {workspaces.length > 1 && (
                <WorkspaceFilter
                  workspaces={workspaces}
                  selectedWorkspaceIds={selectedWorkspaceIds}
                  onWorkspacesChange={handleWorkspacesChange}
                />
              )}

              {viewMode === "week" && (
                <WeeklySummaryButton
                  workspaces={workspaces}
                  selectedWorkspaceId={effectiveSummaryWorkspaceId}
                  onWorkspaceChange={setSummaryWorkspaceId}
                  onGenerate={() => generateSummary(effectiveSummaryWorkspaceId)}
                  isLoading={summaryLoading}
                  hasExisting={!!weeklySummary}
                />
              )}

              {viewMode === "today" && activeTotalCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => estimateAll(allTodayTasks)}
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
          {/* Errors */}
          {estimateError && (
            <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {estimateError}
            </div>
          )}
          {summaryError && (
            <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {summaryError}
            </div>
          )}

          {/* Day Summary Banner (today view) */}
          {viewMode === "today" && daySummary && <DaySummaryBanner summary={daySummary} />}

          {/* Weekly Summary Banner (week view) */}
          {viewMode === "week" && weeklySummary && (
            <WeeklySummaryBanner summary={weeklySummary} />
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading tasks…</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && activeTotalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-lg font-medium mb-1">
                {viewMode === "today" ? "You're all caught up!" : "Nothing due this week!"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {viewMode === "today"
                  ? "No tasks due today. Enjoy your day!"
                  : "No tasks scheduled for this week."}
              </p>
            </div>
          )}

          {/* Suggested tasks (week view, when focus generated) */}
          {!loading && viewMode === "week" && visibleSuggestions.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Suggested This Week
                </h2>
                <span className="text-xs text-muted-foreground">{visibleSuggestions.length}</span>
              </div>
              <div className="rounded-lg border bg-card">
                {visibleSuggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.id}
                    suggestion={suggestion}
                    onSchedule={(date) => handleScheduleSuggestion(suggestion, date)}
                    onDismiss={() => handleDismissSuggestion(suggestion.id)}
                    onTaskClick={() => router.push(`/tasks/${suggestion.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today view — grouped by project */}
          {!loading && viewMode === "today" &&
            filteredTodayGroups.map((group) => (
              <div key={group.projectId ?? "__no_project__"} className="mb-6">
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.projectColor ? (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: group.projectColor }} />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.projectName}
                  </span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </div>
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

          {/* Week view — grouped by day, then by project within each day */}
          {!loading && viewMode === "week" &&
            filteredWeekDayGroups.map((dayGroup) => (
              <div key={dayGroup.dateKey} className="mb-8">
                {/* Day header */}
                <div className="flex items-center gap-2 mb-3">
                  <h2
                    className={cn(
                      "text-sm font-semibold",
                      dayGroup.isOverdue
                        ? "text-red-600 dark:text-red-400"
                        : dayGroup.isToday
                        ? "text-primary"
                        : "text-foreground"
                    )}
                  >
                    {dayGroup.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">{dayGroup.totalCount}</span>
                  {dayGroup.isToday && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Today
                    </span>
                  )}
                </div>

                {/* Project subgroups */}
                <div className="space-y-3">
                  {dayGroup.projectGroups.map((pg) => (
                    <div key={pg.projectId ?? "__no_project__"}>
                      {/* Project label — only show if there's more than one project group */}
                      {dayGroup.projectGroups.length > 1 && (
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          {pg.projectColor ? (
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: pg.projectColor }} />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                          )}
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                            {pg.projectName}
                          </span>
                        </div>
                      )}
                      <div className="rounded-lg border bg-card">
                        {pg.tasks.map((task) => (
                          <TodayTaskRow
                            key={task.id}
                            task={task}
                            estimate={undefined}
                            isEstimating={false}
                            onStatusToggle={handleStatusToggle}
                            onReschedule={(date) => handleReschedule(task, date)}
                            onTaskClick={handleTaskClick}
                            onReestimate={() => {}}
                            showReestimate={false}
                          />
                        ))}
                      </div>
                    </div>
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

// ─── Weekly Summary Button ────────────────────────────────────────────────────

interface WeeklySummaryButtonProps {
  workspaces: Array<{ id: string; name: string }>;
  selectedWorkspaceId: string;
  onWorkspaceChange: (id: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  hasExisting: boolean;
}

function WeeklySummaryButton({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onGenerate,
  isLoading,
  hasExisting,
}: WeeklySummaryButtonProps) {
  return (
    <div className="flex items-center gap-1">
      {workspaces.length > 1 && (
        <select
          value={selectedWorkspaceId}
          onChange={(e) => onWorkspaceChange(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onGenerate}
        disabled={isLoading || !selectedWorkspaceId}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Brain className="h-4 w-4" />
        )}
        {hasExisting ? "Refresh Focus" : "Generate Focus"}
      </Button>
    </div>
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
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          window.open(`/tasks/${task.id}`, "_blank");
          return;
        }
        onTaskClick(task);
      }}
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
          {task.entities && task.entities.map((entity) => {
            const colors = ENTITY_TYPE_COLORS[entity.entity_type] || ENTITY_TYPE_COLORS.product;
            const Icon = entity.entity_type === "initiative" ? Rocket : entity.entity_type === "stakeholder" ? User : Package;
            return (
              <span key={entity.id} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                <Icon className="h-2.5 w-2.5" />
                {entity.name}
              </span>
            );
          })}
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

// ─── Suggestion Row ───────────────────────────────────────────────────────────

interface SuggestionRowProps {
  suggestion: SuggestedTask;
  onSchedule: (date: Date) => void;
  onDismiss: () => void;
  onTaskClick: () => void;
}

function SuggestionRow({ suggestion, onSchedule, onDismiss, onTaskClick }: SuggestionRowProps) {
  return (
    <div
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          window.open(`/tasks/${suggestion.id}`, "_blank");
          return;
        }
        onTaskClick();
      }}
      className="group flex items-center gap-3 py-3 px-3 border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
    >
      {/* Unscheduled indicator */}
      <span className="shrink-0 h-5 w-5 rounded-full border-2 border-dashed border-amber-400 dark:border-amber-500" />

      {/* Title + project */}
      <div className="flex-1 min-w-0">
        <span className="text-sm">{suggestion.title}</span>
        {suggestion.projectName && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {suggestion.projectColor ? (
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: suggestion.projectColor }} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
            )}
            <span className="text-[11px] text-muted-foreground">{suggestion.projectName}</span>
          </div>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ReschedulePopover onReschedule={onSchedule} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Not relevant this week"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
