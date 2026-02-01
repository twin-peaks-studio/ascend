"use client";

import Link from "next/link";
import { MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectWithRelations } from "@/types";
import { PROJECT_STATUS_CONFIG } from "@/types";

interface ProjectCardProps {
  project: ProjectWithRelations;
  onDelete?: (projectId: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const statusConfig = PROJECT_STATUS_CONFIG[project.status];

  // Calculate task counts by status
  const taskCount = project.tasks?.length || 0;
  const completedCount = project.tasks?.filter(t => t.status === "done").length || 0;
  const inProgressCount = project.tasks?.filter(t => t.status === "in-progress").length || 0;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group relative transition-all hover:shadow-md cursor-pointer">
        {/* Color indicator bar */}
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-lg"
          style={{ backgroundColor: project.color }}
        />

        <CardHeader className="pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base line-clamp-1">
                <span className="hover:underline">{project.title}</span>
              </CardTitle>
              {project.description && (
                <CardDescription className="line-clamp-2 mt-1">
                  {project.description}
                </CardDescription>
              )}
            </div>

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Project actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${project.id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete(project.id);
                      }}
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
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project status */}
            <Badge
              variant="secondary"
              className={cn("text-xs", statusConfig.color, statusConfig.bgColor)}
            >
              {statusConfig.label}
            </Badge>

            {/* Task count */}
            {taskCount > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  completedCount === taskCount
                    ? "text-green-600 dark:text-green-400"
                    : inProgressCount > 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground"
                )}
              >
                {completedCount}/{taskCount} tasks
              </Badge>
            )}

            {/* Document count */}
            {project.documents && project.documents.length > 0 && (
              <Badge variant="outline" className="text-xs ml-auto">
                {project.documents.length} doc
                {project.documents.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
