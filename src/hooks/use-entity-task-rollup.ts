"use client";

/**
 * Hook to fetch task rollup data for entity detail pages.
 *
 * For initiatives: fetches all tasks from projects linked to this entity.
 * For products: fetches task counts per linked initiative.
 */

import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { Task } from "@/types";

export interface TaskRollupSummary {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
}

export interface InitiativeTaskRollup {
  projectId: string;
  projectTitle: string;
  projectColor: string;
  tasks: Task[];
  summary: TaskRollupSummary;
}

export interface ProductInitiativeRollup {
  entityId: string;
  entityName: string;
  projectId: string | null;
  projectTitle: string | null;
  summary: TaskRollupSummary;
}

const entityTaskKeys = {
  all: ["entity-tasks"] as const,
  initiative: (entityId: string) => [...entityTaskKeys.all, "initiative", entityId] as const,
  product: (entityId: string) => [...entityTaskKeys.all, "product", entityId] as const,
};

/**
 * Fetch tasks for an initiative entity (via its project).
 */
async function fetchInitiativeTaskRollup(entityId: string): Promise<InitiativeTaskRollup[]> {
  const supabase = getClient();

  // Find projects linked to this initiative entity
  const { data: projects, error: projError } = await withTimeout(
    supabase
      .from("projects")
      .select("id, title, color")
      .eq("entity_id", entityId)
      .eq("status", "active"),
    TIMEOUTS.DATA_QUERY,
    "Fetching initiative projects timed out"
  );

  if (projError) {
    logger.error("Error fetching initiative projects", { entityId, error: projError });
    return [];
  }

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  // Fetch all non-archived tasks for these projects
  const { data: rawTasks, error: taskError } = await withTimeout(
    supabase
      .from("tasks")
      .select("*")
      .in("project_id", projectIds)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching initiative tasks timed out"
  );

  if (taskError) {
    logger.error("Error fetching initiative tasks", { entityId, error: taskError });
    return [];
  }

  const tasks = (rawTasks || []) as Task[];

  // Group tasks by project
  return projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.project_id === project.id);
    return {
      projectId: project.id,
      projectTitle: project.title,
      projectColor: project.color,
      tasks: projectTasks,
      summary: summarizeTasks(projectTasks),
    };
  });
}

interface TaskCountRow {
  project_id: string;
  status: string;
}

/**
 * Fetch task rollup for a product entity (via linked initiative entities → projects).
 */
async function fetchProductTaskRollup(
  entityId: string,
  linkedInitiativeIds: string[]
): Promise<ProductInitiativeRollup[]> {
  if (linkedInitiativeIds.length === 0) return [];

  const supabase = getClient();
  const emptySummary: TaskRollupSummary = { total: 0, todo: 0, in_progress: 0, done: 0 };

  // Find projects for all linked initiative entities
  const { data: projects, error: projError } = await withTimeout(
    supabase
      .from("projects")
      .select("id, title, entity_id")
      .in("entity_id", linkedInitiativeIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching product initiative projects timed out"
  );

  if (projError) {
    logger.error("Error fetching product initiative projects", { entityId, error: projError });
    return [];
  }

  if (!projects || projects.length === 0) {
    return linkedInitiativeIds.map((id) => ({
      entityId: id,
      entityName: "",
      projectId: null,
      projectTitle: null,
      summary: { ...emptySummary },
    }));
  }

  const projectIds = projects.map((p) => p.id);

  // Fetch task status for these projects
  const { data: rawTasks, error: taskError } = await withTimeout(
    supabase
      .from("tasks")
      .select("project_id, status")
      .in("project_id", projectIds)
      .eq("is_archived", false),
    TIMEOUTS.DATA_QUERY,
    "Fetching product task counts timed out"
  );

  if (taskError) {
    logger.error("Error fetching product task counts", { entityId, error: taskError });
    return [];
  }

  const tasks = (rawTasks || []) as TaskCountRow[];

  // Build project_id → task summary map
  const projectSummaryMap = new Map<string, TaskRollupSummary>();
  for (const task of tasks) {
    const existing = projectSummaryMap.get(task.project_id) || { total: 0, todo: 0, in_progress: 0, done: 0 };
    existing.total++;
    if (task.status === "todo") existing.todo++;
    else if (task.status === "in-progress") existing.in_progress++;
    else if (task.status === "done") existing.done++;
    projectSummaryMap.set(task.project_id, existing);
  }

  // Build entity_id → project map
  const entityProjectMap = new Map<string, (typeof projects)[0]>();
  for (const project of projects) {
    if (project.entity_id) {
      entityProjectMap.set(project.entity_id, project);
    }
  }

  return linkedInitiativeIds.map((initId) => {
    const project = entityProjectMap.get(initId);
    return {
      entityId: initId,
      entityName: "",
      projectId: project?.id ?? null,
      projectTitle: project?.title ?? null,
      summary: project ? (projectSummaryMap.get(project.id) ?? { ...emptySummary }) : { ...emptySummary },
    };
  });
}

function summarizeTasks(tasks: { status: string }[]): TaskRollupSummary {
  const summary: TaskRollupSummary = { total: 0, todo: 0, in_progress: 0, done: 0 };
  for (const task of tasks) {
    summary.total++;
    if (task.status === "todo") summary.todo++;
    else if (task.status === "in-progress") summary.in_progress++;
    else if (task.status === "done") summary.done++;
  }
  return summary;
}

/**
 * Hook to fetch task rollup for an initiative entity.
 * Returns tasks grouped by project with status summary.
 */
export function useInitiativeTaskRollup(entityId: string | null) {
  return useQuery({
    queryKey: entityTaskKeys.initiative(entityId ?? ""),
    queryFn: () => fetchInitiativeTaskRollup(entityId!),
    enabled: !!entityId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch task rollup for a product entity.
 * Pass the IDs of linked initiative entities.
 */
export function useProductTaskRollup(entityId: string | null, linkedInitiativeIds: string[]) {
  return useQuery({
    queryKey: entityTaskKeys.product(entityId ?? ""),
    queryFn: () => fetchProductTaskRollup(entityId!, linkedInitiativeIds),
    enabled: !!entityId && linkedInitiativeIds.length > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
