"use client";

/**
 * Project Document Hooks
 *
 * Custom hooks for managing project documents (links, notes, documents).
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectDocument } from "@/types";
import type { ProjectDocumentInsert } from "@/types/database";
import {
  createDocumentSchema,
  type CreateDocumentInput,
} from "@/lib/validation";
import { toast } from "sonner";

/**
 * Hook to fetch documents for a specific project
 */
export function useProjectDocuments(projectId: string | null) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchDocuments = useCallback(async () => {
    if (!projectId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setDocuments((data as ProjectDocument[]) || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch documents")
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
  };
}

/**
 * Hook for document mutations (create, delete)
 */
export function useDocumentMutations() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const createDocument = useCallback(
    async (input: CreateDocumentInput): Promise<ProjectDocument | null> => {
      try {
        setLoading(true);

        // Validate input
        const validated = createDocumentSchema.parse(input);

        const insertData: ProjectDocumentInsert = {
          project_id: validated.project_id,
          title: validated.title,
          url: validated.url ?? null,
          content: validated.content ?? null,
          type: validated.type,
        };

        const { data, error } = await supabase
          .from("project_documents")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        const typeLabel =
          validated.type === "link"
            ? "Link"
            : validated.type === "note"
            ? "Note"
            : "Document";
        toast.success(`${typeLabel} added successfully`);
        return data as ProjectDocument;
      } catch (err) {
        console.error("Error creating document:", err);
        toast.error("Failed to add document");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const deleteDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        setLoading(true);

        const { error } = await supabase
          .from("project_documents")
          .delete()
          .eq("id", documentId);

        if (error) throw error;

        toast.success("Document removed successfully");
        return true;
      } catch (err) {
        console.error("Error deleting document:", err);
        toast.error("Failed to remove document");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  return {
    createDocument,
    deleteDocument,
    loading,
  };
}
