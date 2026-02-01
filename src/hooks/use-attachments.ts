"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Attachment, AttachmentInsert } from "@/types";

type EntityType = "task" | "project";

const STORAGE_BUCKET = "attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Hook for managing attachments for a task or project
 */
export function useAttachments(entityType: EntityType, entityId: string | null) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    if (!entityId) {
      setAttachments([]);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching attachments:", fetchError);
      setError(fetchError.message);
      setAttachments([]);
    } else {
      setAttachments((data as Attachment[]) || []);
    }

    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  /**
   * Upload a file and create an attachment record
   */
  const uploadFile = useCallback(
    async (file: File): Promise<Attachment | null> => {
      if (!entityId) {
        toast.error("Cannot upload: no entity selected");
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        return null;
      }

      setUploading(true);
      setError(null);

      const supabase = createClient();

      try {
        // Generate unique file path: entityType/entityId/timestamp-filename
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${entityType}/${entityId}/${timestamp}-${safeName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Create attachment record in database
        const attachmentData: AttachmentInsert = {
          entity_type: entityType,
          entity_id: entityId,
          filename: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
        };

        const { data: attachment, error: insertError } = await supabase
          .from("attachments")
          .insert(attachmentData)
          .select()
          .single();

        if (insertError) {
          // Try to delete the uploaded file if DB insert fails
          await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
          throw insertError;
        }

        toast.success(`Uploaded ${file.name}`);
        const typedAttachment = attachment as Attachment;
        setAttachments((prev) => [typedAttachment, ...prev]);
        return typedAttachment;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        console.error("Upload error:", err);
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId]
  );

  /**
   * Delete an attachment (removes from storage and database)
   */
  const deleteAttachment = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      const attachment = attachments.find((a) => a.id === attachmentId);
      if (!attachment) {
        toast.error("Attachment not found");
        return false;
      }

      const supabase = createClient();

      try {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([attachment.file_path]);

        if (storageError) {
          console.warn("Storage delete error:", storageError);
          // Continue to delete DB record even if storage fails
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from("attachments")
          .delete()
          .eq("id", attachmentId);

        if (dbError) {
          throw dbError;
        }

        toast.success(`Deleted ${attachment.filename}`);
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        console.error("Delete error:", err);
        toast.error(message);
        return false;
      }
    },
    [attachments]
  );

  /**
   * Get public URL for an attachment
   */
  const getFileUrl = useCallback((attachment: Attachment): string => {
    const supabase = createClient();
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(attachment.file_path);
    return data.publicUrl;
  }, []);

  /**
   * Download an attachment
   */
  const downloadFile = useCallback(
    async (attachment: Attachment): Promise<void> => {
      const supabase = createClient();

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(attachment.file_path);

      if (error || !data) {
        toast.error("Failed to download file");
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    []
  );

  return {
    attachments,
    loading,
    uploading,
    error,
    uploadFile,
    deleteAttachment,
    getFileUrl,
    downloadFile,
    refetch: fetchAttachments,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
