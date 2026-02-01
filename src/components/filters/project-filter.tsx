"use client";

import { useState, useMemo } from "react";
import { Check, ChevronDown, FolderKanban, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface ProjectFilterProps {
  projects: Project[];
  selectedProjectIds: string[];
  onProjectsChange: (projectIds: string[]) => void;
}

export function ProjectFilter({
  projects,
  selectedProjectIds,
  onProjectsChange,
}: ProjectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filter and sort projects - selected ones at the top
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((project) =>
        project.title.toLowerCase().includes(searchLower)
      );
    }

    // Sort: selected projects first, then alphabetically within each group
    return [...filtered].sort((a, b) => {
      const aSelected = selectedProjectIds.includes(a.id);
      const bSelected = selectedProjectIds.includes(b.id);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [projects, search, selectedProjectIds]);

  // Get selected projects for display
  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedProjectIds.includes(p.id)),
    [projects, selectedProjectIds]
  );

  const handleToggle = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      onProjectsChange(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      onProjectsChange([...selectedProjectIds, projectId]);
    }
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onProjectsChange([]);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 px-3",
            selectedProjectIds.length > 0 && "bg-primary/10 border-primary/30"
          )}
        >
          {selectedProjects.length > 0 ? (
            <>
              {selectedProjects.length === 1 ? (
                <>
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: selectedProjects[0].color }}
                  />
                  <span className="max-w-[120px] truncate">{selectedProjects[0].title}</span>
                </>
              ) : (
                <>
                  <div className="flex -space-x-1">
                    {selectedProjects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="h-3 w-3 rounded-sm ring-2 ring-background"
                        style={{ backgroundColor: project.color }}
                      />
                    ))}
                  </div>
                  <span>{selectedProjects.length} projects</span>
                </>
              )}
              <span
                role="button"
                tabIndex={0}
                className="flex items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                onClick={handleClearAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleClearAll(e as unknown as React.MouseEvent);
                  }
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </span>
            </>
          ) : (
            <>
              <FolderKanban className="h-4 w-4" />
              <span>Project</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
          {selectedProjects.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>

        {/* Project list */}
        <div className="max-h-[300px] overflow-y-auto p-1">
          {/* All tasks option */}
          <button
            onClick={() => handleClearAll()}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
              selectedProjectIds.length === 0 && "bg-muted"
            )}
          >
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left">All Projects</span>
            {selectedProjectIds.length === 0 && <Check className="h-4 w-4" />}
          </button>

          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => {
              const isSelected = selectedProjectIds.includes(project.id);
              return (
                <button
                  key={project.id}
                  onClick={() => handleToggle(project.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                    isSelected && "bg-muted"
                  )}
                >
                  <div
                    className="h-4 w-4 rounded-sm"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 truncate text-left">{project.title}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })
          ) : (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No projects found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
