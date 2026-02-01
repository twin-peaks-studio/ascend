"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSearch } from "@/hooks/use-search";
import { useProfiles } from "@/hooks/use-profiles";
import { useProjects } from "@/hooks/use-projects";
import { TaskDetailsResponsive } from "@/components/task";
import { useTaskMutations } from "@/hooks/use-tasks";
import type { TaskWithProject, Project } from "@/types";
import type { UpdateTaskInput } from "@/lib/validation";
import { PRIORITY_DISPLAY_SHORT, STATUS_CONFIG } from "@/types";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { results, loading, search, clearResults } = useSearch();
  const { profiles } = useProfiles();
  const { projects } = useProjects();
  const { updateTask, deleteTask } = useTaskMutations();

  // Task details state
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      clearResults();
      return;
    }

    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search, clearResults]);

  // Handle dialog open change with state cleanup
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Clear state when closing
      setQuery("");
      clearResults();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, clearResults]);

  // Handle task click - open task details
  const handleTaskClick = useCallback((task: TaskWithProject) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
    handleOpenChange(false);
  }, [handleOpenChange]);

  // Handle project click - navigate to project page
  const handleProjectClick = useCallback((project: Project) => {
    handleOpenChange(false);
    router.push(`/projects/${project.id}`);
  }, [router, handleOpenChange]);

  // Handle task update from details dialog
  const handleTaskUpdate = useCallback(
    async (data: UpdateTaskInput) => {
      if (!selectedTask) return;
      const result = await updateTask(selectedTask.id, data);
      if (result) {
        // Update the project reference if needed
        let updatedProject = selectedTask.project;
        if ("project_id" in data) {
          if (data.project_id === null) {
            updatedProject = null;
          } else {
            updatedProject = projects.find((p) => p.id === data.project_id) || null;
          }
        }
        setSelectedTask({
          ...selectedTask,
          ...data,
          project: updatedProject,
        } as TaskWithProject);
      }
    },
    [selectedTask, updateTask, projects]
  );

  // Handle task delete confirmation
  const handleDeleteTaskConfirm = useCallback(async () => {
    if (!deleteTaskConfirm) return;
    await deleteTask(deleteTaskConfirm);
    setDeleteTaskConfirm(null);
    setSelectedTask(null);
  }, [deleteTaskConfirm, deleteTask]);

  const hasResults = results.tasks.length > 0 || results.projects.length > 0;
  const showNoResults = query.trim() && !loading && !hasResults;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg gap-0 p-0" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search tasks and projects..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 p-0 shadow-none focus-visible:ring-0"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Tasks Section */}
            {results.tasks.length > 0 && (
              <div className="p-2">
                <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                  Tasks
                </p>
                {results.tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn(STATUS_CONFIG[task.status].color)}>
                          {STATUS_CONFIG[task.status].label}
                        </span>
                        {task.priority && (
                          <>
                            <span>-</span>
                            <span className={PRIORITY_DISPLAY_SHORT[task.priority].color}>
                              {PRIORITY_DISPLAY_SHORT[task.priority].label}
                            </span>
                          </>
                        )}
                        {task.project && (
                          <>
                            <span>-</span>
                            <span className="truncate">{task.project.title}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Projects Section */}
            {results.projects.length > 0 && (
              <div className="p-2">
                <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                  Projects
                </p>
                {results.projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectClick(project)}
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <div
                      className="mt-0.5 h-4 w-4 shrink-0 rounded"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{project.title}</p>
                      {project.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {showNoResults && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 h-8 w-8 opacity-50" />
                <p>No results found for &ldquo;{query}&rdquo;</p>
                <p className="mt-1 text-sm">Try a different search term</p>
              </div>
            )}

            {/* Empty State */}
            {!query.trim() && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 h-8 w-8 opacity-50" />
                <p>Search for tasks and projects</p>
                <p className="mt-1 text-sm">Start typing to see results</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <TaskDetailsResponsive
        open={showTaskDetails}
        onOpenChange={(open) => {
          setShowTaskDetails(open);
          if (!open) setSelectedTask(null);
        }}
        task={selectedTask}
        profiles={profiles}
        projects={projects}
        onUpdate={handleTaskUpdate}
        onDelete={(taskId) => {
          setShowTaskDetails(false);
          setDeleteTaskConfirm(taskId);
        }}
      />

      {/* Delete task confirmation */}
      <AlertDialog
        open={!!deleteTaskConfirm}
        onOpenChange={(open) => !open && setDeleteTaskConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTaskConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
