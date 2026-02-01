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
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

export function ProjectFilter({
  projects,
  selectedProjectId,
  onProjectChange,
}: ProjectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filter projects based on search
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const searchLower = search.toLowerCase();
    return projects.filter((project) =>
      project.title.toLowerCase().includes(searchLower)
    );
  }, [projects, search]);

  // Get selected project
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const handleSelect = (projectId: string | null) => {
    onProjectChange(projectId);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onProjectChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 px-3",
            selectedProjectId && "bg-primary/10 border-primary/30"
          )}
        >
          {selectedProject ? (
            <>
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: selectedProject.color }}
              />
              <span className="max-w-[120px] truncate">{selectedProject.title}</span>
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
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
      <PopoverContent className="w-64 p-0" align="start">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {/* Project list */}
        <div className="max-h-[300px] overflow-y-auto p-1">
          {/* All tasks option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
              !selectedProjectId && "bg-muted"
            )}
          >
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left">All Projects</span>
            {!selectedProjectId && <Check className="h-4 w-4" />}
          </button>

          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                  selectedProjectId === project.id && "bg-muted"
                )}
              >
                <div
                  className="h-4 w-4 rounded-sm"
                  style={{ backgroundColor: project.color }}
                />
                <span className="flex-1 truncate text-left">{project.title}</span>
                {selectedProjectId === project.id && <Check className="h-4 w-4" />}
              </button>
            ))
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
