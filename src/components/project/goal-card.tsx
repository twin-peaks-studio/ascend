"use client";

import Link from "next/link";
import { Target, MoreHorizontal, Trash2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDueDate, isOverdue } from "@/lib/date-utils";
import type { ProjectWithRelations } from "@/types";

interface GoalCardProps {
  project: ProjectWithRelations;
  onDelete?: (projectId: string) => void;
  workspaceId?: string;
}

export function GoalCard({ project, onDelete, workspaceId }: GoalCardProps) {
  const taskCount = project.tasks?.length || 0;
  const doneCount = project.tasks?.filter((t) => t.status === "done").length || 0;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const overdue = project.due_date && isOverdue(project.due_date) && project.status !== "completed";

  const href = workspaceId
    ? `/projects/${project.id}?workspace=${workspaceId}`
    : `/projects/${project.id}`;

  return (
    <Link href={href}>
      <Card className="group relative transition-all hover:shadow-md cursor-pointer border-violet-200/50 dark:border-violet-800/30">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Target className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{project.title}</p>
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => { e.preventDefault(); onDelete(project.id); }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Progress bar */}
          {taskCount > 0 && (
            <div className="mb-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress === 100 ? "bg-green-500" : "bg-violet-500"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2">
            {taskCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {doneCount}/{taskCount} tasks
              </span>
            )}
            {project.due_date && (
              <span className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "text-red-500" : "text-muted-foreground"
              )}>
                <Calendar className="h-3 w-3" />
                {formatDueDate(project.due_date)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
