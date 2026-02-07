import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting account deletion", { userId: user.id });

    // Step 1: Delete user's avatar from storage
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();

      if (profile?.avatar_url) {
        const path = profile.avatar_url.split("/").slice(-2).join("/");
        await supabase.storage.from("avatars").remove([path]);
      }
    } catch (error) {
      logger.warn("Failed to delete avatar during account deletion", { userId: user.id, error });
    }

    // Step 2: Delete attachments from storage for user's tasks and projects
    try {
      // Get all tasks owned by or assigned to user
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);

      // Get all projects owned by user
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("created_by", user.id);

      const taskIds = tasks?.map((t) => t.id) || [];
      const projectIds = projects?.map((p) => p.id) || [];

      // Get all attachments for these entities
      if (taskIds.length > 0) {
        const { data: taskAttachments } = await supabase
          .from("attachments")
          .select("file_path")
          .eq("entity_type", "task")
          .in("entity_id", taskIds);

        if (taskAttachments && taskAttachments.length > 0) {
          const paths = taskAttachments.map((a: { file_path: string }) => a.file_path);
          await supabase.storage.from("attachments").remove(paths);
        }
      }

      if (projectIds.length > 0) {
        const { data: projectAttachments } = await supabase
          .from("attachments")
          .select("file_path")
          .eq("entity_type", "project")
          .in("entity_id", projectIds);

        if (projectAttachments && projectAttachments.length > 0) {
          const paths = projectAttachments.map((a: { file_path: string }) => a.file_path);
          await supabase.storage.from("attachments").remove(paths);
        }
      }
    } catch (error) {
      logger.warn("Failed to delete attachments during account deletion", { userId: user.id, error });
    }

    // Step 3: Delete database records (in order to respect foreign keys)
    // Many of these will cascade, but we're explicit for safety

    // Delete project memberships
    await supabase.from("project_members").delete().eq("user_id", user.id);

    // Delete time tracking records
    await supabase.from("time_entries").delete().eq("user_id", user.id);

    // Delete notes
    await supabase.from("notes").delete().eq("created_by", user.id);

    // Delete tasks (owned and assigned)
    await supabase.from("tasks").delete().eq("created_by", user.id);
    await supabase.from("tasks").delete().eq("assigned_to", user.id);

    // Delete projects owned by user (attachments will cascade delete from DB)
    await supabase.from("projects").delete().eq("created_by", user.id);

    // Delete profile
    await supabase.from("profiles").delete().eq("id", user.id);

    // Step 4: Delete auth user (this should be last)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      logger.error("Failed to delete auth user", {
        userId: user.id,
        error: deleteAuthError,
      });
      return NextResponse.json(
        { error: "Failed to delete account. Please contact support." },
        { status: 500 }
      );
    }

    logger.info("Account deleted successfully", { userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Account deletion error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
