/**
 * Feedback Forms — Integration Adapter
 *
 * Defines the PMAdapter interface that decouples form/submission logic from
 * any specific project management tool. v1 ships with AscendAdapter, which
 * writes directly to the Ascend Supabase database via the service role client.
 *
 * Post-v1: implement this interface for Todoist, Linear, Jira, etc. without
 * touching any form or submission code.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import type { TaskStatus, TaskPriority, TrackerTask, TrackerAttachment } from "@/types";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface CreateTaskParams {
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** FK back to the feedback_submissions row */
  feedbackSubmissionId: string;
}

export interface UpdateTaskParams {
  title?: string;
  description?: string;
}

export interface PMAdapter {
  /**
   * Create a task in the PM tool and return the task ID.
   */
  createTask(params: CreateTaskParams): Promise<{ taskId: string }>;

  /**
   * Update an existing task's title and/or description.
   * Called after the AI follow-up completes with final content.
   */
  updateTask(taskId: string, params: UpdateTaskParams): Promise<void>;

  /**
   * Fetch a single task's current state (title, description, status).
   */
  getTask(taskId: string): Promise<{ title: string; description: string; status: string } | null>;

  /**
   * List all tasks linked to a given feedback form, for the tracker view.
   */
  listTasks(formId: string): Promise<TrackerTask[]>;
}

// ─── AscendAdapter ────────────────────────────────────────────────────────────

/**
 * Implements PMAdapter against the Ascend Supabase database.
 * Uses the service role client — bypasses RLS.
 * All tester-facing API routes use this adapter.
 */
export class AscendAdapter implements PMAdapter {
  private get db() {
    return createServiceClient();
  }

  async createTask(params: CreateTaskParams): Promise<{ taskId: string }> {
    const { data, error } = await this.db
      .from("tasks")
      .insert({
        title: params.title,
        description: params.description,
        project_id: params.projectId,
        status: params.status,
        priority: params.priority,
        source_type: "feedback_form",
        feedback_submission_id: params.feedbackSubmissionId,
        // Assign to the project lead if one is set, otherwise unassigned.
        assignee_id: await this._getProjectLead(params.projectId),
        due_date: null,
        position: 0,
        section_position: 0,
        created_by: await this._getProjectCreator(params.projectId),
      })
      .select("id")
      .single();

    if (error || !data) {
      logger.error("AscendAdapter.createTask failed", {
        error,
        projectId: params.projectId,
        feedbackSubmissionId: params.feedbackSubmissionId,
      });
      throw new Error("Failed to create task from feedback submission");
    }

    return { taskId: data.id };
  }

  async updateTask(taskId: string, params: UpdateTaskParams): Promise<void> {
    const update: Record<string, string> = {};
    if (params.title !== undefined) update.title = params.title;
    if (params.description !== undefined) update.description = params.description;

    if (Object.keys(update).length === 0) return;

    const { error } = await this.db
      .from("tasks")
      .update(update)
      .eq("id", taskId);

    if (error) {
      logger.error("AscendAdapter.updateTask failed", { error, taskId });
      throw new Error("Failed to update task");
    }
  }

  async getTask(
    taskId: string
  ): Promise<{ title: string; description: string; status: string } | null> {
    const { data, error } = await this.db
      .from("tasks")
      .select("title, description, status")
      .eq("id", taskId)
      .single();

    if (error || !data) return null;
    return {
      title: data.title,
      description: data.description ?? "",
      status: data.status,
    };
  }

  async listTasks(formId: string): Promise<TrackerTask[]> {
    // Join feedback_submissions → tasks for all submissions belonging to this form.
    const { data, error } = await this.db
      .from("feedback_submissions")
      .select(
        `
        id,
        submitted_at,
        task_id,
        tasks!feedback_submissions_task_id_fkey (
          id,
          title,
          description,
          status,
          priority
        )
      `
      )
      .eq("form_id", formId)
      .not("task_id", "is", null)
      .order("submitted_at", { ascending: false });

    if (error) {
      logger.error("AscendAdapter.listTasks failed", { error, formId });
      return [];
    }

    const rows = (data ?? []).filter((row) => row.tasks);

    // Fetch full attachment details for all tasks in one query.
    // attachments uses a polymorphic entity_id (no FK), so we can't use PostgREST join.
    const taskIds = rows
      .map((row) => (row.tasks as { id: string } | null)?.id)
      .filter(Boolean) as string[];

    const attachmentMap = new Map<string, TrackerAttachment[]>();
    if (taskIds.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const { data: attachmentRows } = await this.db
        .from("attachments")
        .select("id, entity_id, filename, file_path, file_size, mime_type")
        .eq("entity_type", "task")
        .in("entity_id", taskIds);

      for (const a of attachmentRows ?? []) {
        const url = `${supabaseUrl}/storage/v1/object/public/attachments/${a.file_path}`;
        const existing = attachmentMap.get(a.entity_id) ?? [];
        existing.push({
          id: a.id,
          filename: a.filename,
          fileSize: a.file_size,
          mimeType: a.mime_type,
          url,
        });
        attachmentMap.set(a.entity_id, existing);
      }
    }

    return rows.map((row) => {
      const task = row.tasks as {
        id: string;
        title: string;
        description: string | null;
        status: TaskStatus;
        priority: TaskPriority;
      };
      const attachments = attachmentMap.get(task.id) ?? [];
      return {
        taskId: task.id,
        submissionId: row.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        submittedAt: row.submitted_at,
        attachmentCount: attachments.length,
        attachments,
      };
    });
  }

  /** Fetch the project lead ID, or null if no lead is set. */
  private async _getProjectLead(projectId: string): Promise<string | null> {
    const { data } = await this.db
      .from("projects")
      .select("lead_id")
      .eq("id", projectId)
      .single();

    return data?.lead_id ?? null;
  }

  /** Fetch the created_by user ID for a project (used when creating tasks from submissions). */
  private async _getProjectCreator(projectId: string): Promise<string> {
    const { data } = await this.db
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    if (!data?.created_by) {
      throw new Error(`Project ${projectId} not found or has no creator`);
    }
    return data.created_by;
  }
}

/** Singleton adapter instance for use in API routes. */
export const ascendAdapter = new AscendAdapter();
