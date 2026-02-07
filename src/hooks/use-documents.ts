"use client";

/**
 * Project Document Hooks
 *
 * Custom hooks for managing project documents (links, notes, documents).
 * Uses React Query for request deduplication and caching.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { ProjectDocument } from "@/types";
import type { ProjectDocumentInsert } from "@/types/database";
import {
  createDocumentSchema,
  type CreateDocumentInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (projectId: string) => [...documentKeys.lists(), projectId] as const,
};

/**
 * Fetch documents for a project
 */
async function fetchProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching documents timed out"
  );

  if (result.error) throw result.error;
  return (result.data as ProjectDocument[]) || [];
}

/**
 * Hook to fetch documents for a specific project
 * Uses React Query for deduplication
 */
export function useProjectDocuments(projectId: string | null) {
  const {
    data: documents = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: documentKeys.list(projectId ?? ""),
    queryFn: () => fetchProjectDocuments(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchOnWindowFocus: true,
  });

  return {
    documents,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook for document mutations (create, delete)
 */
export function useDocumentMutations() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const createDocument = useCallback(
    async (input: CreateDocumentInput): Promise<ProjectDocument | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

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

        // Invalidate documents cache for this project
        queryClient.invalidateQueries({ queryKey: documentKeys.list(validated.project_id) });

        const typeLabel =
          validated.type === "link"
            ? "Link"
            : validated.type === "note"
            ? "Note"
            : "Document";
        toast.success(`${typeLabel} added successfully`);
        return data as ProjectDocument;
      } catch (err) {
        logger.error("Error creating document", {
          projectId: input.project_id,
          documentType: input.type,
          error: err
        });
        toast.error("Failed to add document");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteDocument = useCallback(
    async (documentId: string, projectId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await supabase
          .from("project_documents")
          .delete()
          .eq("id", documentId);

        if (error) throw error;

        // Invalidate documents cache
        queryClient.invalidateQueries({ queryKey: documentKeys.list(projectId) });

        toast.success("Document removed successfully");
        return true;
      } catch (err) {
        logger.error("Error deleting document", {
          documentId,
          projectId,
          error: err
        });
        toast.error("Failed to remove document");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createDocument,
    deleteDocument,
    loading,
  };
}
