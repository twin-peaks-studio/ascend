"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/shared";
import { useProject } from "@/hooks/use-projects";
import { useNoteMutations } from "@/hooks/use-notes";

export default function CreateNotePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { project, loading: projectLoading } = useProject(projectId);
  const { createNote, loading: noteMutationLoading } = useNoteMutations();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const note = await createNote({
      project_id: projectId,
      title: title.trim(),
      content: content.trim() || null,
    });

    if (note) {
      // Navigate to the newly created note
      router.push(`/projects/${projectId}/notes/${note.id}`);
    }
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}`);
  };

  if (projectLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Project not found</p>
            <Button asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link
                href={`/projects/${projectId}`}
                className="hover:text-foreground transition-colors"
              >
                {project.title}
              </Link>
              <span>/</span>
              <span>New Note</span>
            </div>
            <h1 className="text-2xl font-bold">Create Note</h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting notes, discussion points, etc."
              maxLength={200}
              autoFocus
              required
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Start typing your notes... (supports **bold**, *italic*, - bullets)"
              rows={12}
              maxLength={50000}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={noteMutationLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || noteMutationLoading}
            >
              {noteMutationLoading ? "Creating..." : "Create Note"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
