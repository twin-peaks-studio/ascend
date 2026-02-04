"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Plus,
  LayoutGrid,
  List,
  Check,
  Search,
  ChevronRight,
  X,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  TASK_SORT_OPTIONS,
  getSortOptionKey,
  type TaskSortField,
  type TaskSortDirection,
} from "@/lib/task-sort";
import type { ViewMode } from "./header";
import type { Project } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dash",
    icon: LayoutDashboard,
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
  },
];

interface MobileBottomNavProps {
  onAddTask?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  projects?: Project[];
  selectedProjectIds?: string[];
  onProjectsChange?: (projectIds: string[]) => void;
  sortField?: TaskSortField;
  sortDirection?: TaskSortDirection;
  onSortChange?: (field: TaskSortField, direction: TaskSortDirection) => void;
}

type FilterView = "main" | "project" | "sort";

export function MobileBottomNav({
  onAddTask,
  viewMode,
  onViewModeChange,
  projects = [],
  selectedProjectIds = [],
  onProjectsChange,
  sortField = "position",
  sortDirection = "asc",
  onSortChange,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [filterView, setFilterView] = useState<FilterView>("main");
  const [projectSearch, setProjectSearch] = useState("");

  // Show settings button on tasks pages (global tasks and project tasks)
  const showSettingsButton = pathname === "/tasks" || pathname.match(/^\/projects\/[^/]+\/tasks$/);

  // Filter and sort projects - selected ones at the top
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (projectSearch.trim()) {
      const searchLower = projectSearch.toLowerCase();
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
  }, [projects, projectSearch, selectedProjectIds]);

  // Get selected projects for display
  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedProjectIds.includes(p.id)),
    [projects, selectedProjectIds]
  );

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = selectedProjectIds.length;
    // Count non-default sorting as an active filter
    if (sortField !== "position" || sortDirection !== "asc") {
      count += 1;
    }
    return count;
  }, [selectedProjectIds, sortField, sortDirection]);

  // Get the current sort option label
  const currentSortLabel = useMemo(() => {
    const currentKey = getSortOptionKey(sortField, sortDirection);
    const option = TASK_SORT_OPTIONS.find(
      (opt) => getSortOptionKey(opt.field, opt.direction) === currentKey
    );
    return option?.label || "Default";
  }, [sortField, sortDirection]);

  // Reset filter view when sheet closes
  const handleSheetChange = (open: boolean) => {
    setShowSettings(open);
    if (!open) {
      setFilterView("main");
      setProjectSearch("");
    }
  };

  // Toggle a single project
  const handleToggleProject = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      onProjectsChange?.(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      onProjectsChange?.([...selectedProjectIds, projectId]);
    }
  };

  // Get project summary text
  const getProjectSummaryText = () => {
    if (selectedProjects.length === 0) return "All projects";
    if (selectedProjects.length === 1) return selectedProjects[0].title;
    return `${selectedProjects.length} projects`;
  };

  return (
    <>
      {/* Floating Settings Button - visible on tasks page for mobile/tablet */}
      {showSettingsButton && (
        <button
          onClick={() => setShowSettings(true)}
          className="fixed bottom-28 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-lg ring-1 ring-border/50 transition-transform hover:scale-105 active:scale-95 lg:hidden"
          aria-label="View options"
        >
          <Filter className="h-5 w-5" />
          {/* Filter count badge */}
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Add Button - visible on mobile and tablet (below lg) */}
      <button
        onClick={onAddTask}
        className="fixed bottom-28 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95 lg:hidden"
        aria-label="Add new task"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      {/* Bottom Navigation Bar - visible on mobile and tablet (below lg) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="mx-3 mb-4">
          <div className="flex items-center gap-2">
            {/* Main Nav Items - Pill Container */}
            <div className="flex flex-1 items-center justify-around rounded-full bg-card/95 px-1 py-1.5 shadow-lg ring-1 ring-border/50 backdrop-blur-md dark:bg-card/90">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-full px-5 py-2 transition-all",
                      isActive
                        ? "bg-muted text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    <span className={cn(
                      "text-[11px] font-medium",
                      isActive && "text-primary"
                    )}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

          </div>
        </div>
      </nav>

      {/* View Options Sheet */}
      <Sheet open={showSettings} onOpenChange={handleSheetChange}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[80vh] overflow-hidden flex flex-col">
          {/* Main View */}
          {filterView === "main" && (
            <>
              <SheetHeader className="pb-4 flex-shrink-0">
                <SheetTitle>View Options</SheetTitle>
              </SheetHeader>

              <div className="overflow-y-auto flex-1">
                {/* Filters Section */}
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Filters
                  </p>

                  {/* Project Filter Row */}
                  {projects.length > 0 && (
                    <button
                      onClick={() => setFilterView("project")}
                      className="flex items-center gap-3 w-full p-3 rounded-lg transition-colors hover:bg-muted"
                    >
                      <FolderKanban className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 text-left">
                        <p className="font-medium">Project</p>
                        <p className="text-xs text-muted-foreground">
                          {getProjectSummaryText()}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {/* Sort Row */}
                  {onSortChange && (
                    <button
                      onClick={() => setFilterView("sort")}
                      className="flex items-center gap-3 w-full p-3 rounded-lg transition-colors hover:bg-muted"
                    >
                      <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 text-left">
                        <p className="font-medium">Sort</p>
                        <p className="text-xs text-muted-foreground">
                          {currentSortLabel}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {/* Clear all filters option - only visible when filters are active */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        onProjectsChange?.([]);
                        onSortChange?.("position", "asc");
                      }}
                      className="flex items-center gap-3 w-full p-3 rounded-lg transition-colors text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-5 w-5" />
                      <span className="font-medium">Clear all filters</span>
                    </button>
                  )}
                </div>

                {/* Layout Section */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Layout
                  </p>
                  <button
                    onClick={() => {
                      onViewModeChange?.("board");
                      setShowSettings(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-lg transition-colors",
                      viewMode === "board"
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <LayoutGrid className="h-5 w-5" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Board</p>
                      <p className="text-xs text-muted-foreground">Kanban-style columns</p>
                    </div>
                    {viewMode === "board" && <Check className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => {
                      onViewModeChange?.("list");
                      setShowSettings(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-lg transition-colors",
                      viewMode === "list"
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <List className="h-5 w-5" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">List</p>
                      <p className="text-xs text-muted-foreground">Simple task list</p>
                    </div>
                    {viewMode === "list" && <Check className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Project Selection View */}
          {filterView === "project" && (
            <>
              <SheetHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFilterView("main");
                      setProjectSearch("");
                    }}
                    className="p-1 -ml-1 rounded-md hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </button>
                  <SheetTitle>Select Projects</SheetTitle>
                </div>
              </SheetHeader>

              {/* Search Input */}
              <div className="flex items-center gap-2 px-1 py-2 border-b mb-2 flex-shrink-0">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="h-9 border-0 p-0 shadow-none focus-visible:ring-0 text-base"
                />
                {projectSearch && (
                  <button
                    onClick={() => setProjectSearch("")}
                    className="p-1 rounded-md hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Project List */}
              <div className="overflow-y-auto flex-1 space-y-1">
                {/* All Projects option */}
                <button
                  onClick={() => {
                    onProjectsChange?.([]);
                    setFilterView("main");
                    setProjectSearch("");
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full p-3 rounded-lg transition-colors",
                    selectedProjectIds.length === 0
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <FolderKanban className="h-5 w-5" />
                  <span className="flex-1 text-left font-medium">All Projects</span>
                  {selectedProjectIds.length === 0 && <Check className="h-5 w-5" />}
                </button>

                {filteredProjects.map((project) => {
                  const isSelected = selectedProjectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => handleToggleProject(project.id)}
                      className={cn(
                        "flex items-center gap-3 w-full p-3 rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <div
                        className="h-5 w-5 rounded"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="flex-1 text-left font-medium truncate">
                        {project.title}
                      </span>
                      {isSelected && <Check className="h-5 w-5" />}
                    </button>
                  );
                })}

                {filteredProjects.length === 0 && projectSearch && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No projects found
                  </p>
                )}
              </div>
            </>
          )}

          {/* Sort Selection View */}
          {filterView === "sort" && (
            <>
              <SheetHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterView("main")}
                    className="p-1 -ml-1 rounded-md hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </button>
                  <SheetTitle>Sort Tasks</SheetTitle>
                </div>
              </SheetHeader>

              <div className="overflow-y-auto flex-1 space-y-1 pt-2">
                {TASK_SORT_OPTIONS.map((option) => {
                  const optionKey = getSortOptionKey(option.field, option.direction);
                  const currentKey = getSortOptionKey(sortField, sortDirection);
                  const isSelected = optionKey === currentKey;

                  return (
                    <button
                      key={optionKey}
                      onClick={() => {
                        onSortChange?.(option.field, option.direction);
                        setFilterView("main");
                      }}
                      className={cn(
                        "flex items-center gap-3 w-full p-3 rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <ArrowUpDown className="h-5 w-5" />
                      <span className="flex-1 text-left font-medium">
                        {option.label}
                      </span>
                      {isSelected && <Check className="h-5 w-5" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
