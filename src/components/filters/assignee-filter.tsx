"use client";

import { useState, useMemo } from "react";
import { Check, ChevronDown, Search, Users, UserCheck, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getProfileInitials, getDisplayName } from "@/lib/profile-utils";
import type { Profile } from "@/types";
import type { TaskWithProject } from "@/types";

export const ASSIGNEE_FILTER_ASSIGNED_TO_ME = "__assigned-to-me__";
export const ASSIGNEE_FILTER_UNASSIGNED = "__unassigned__";

interface AssigneeFilterProps {
  profiles: Profile[];
  tasks: TaskWithProject[];
  selectedAssigneeIds: string[];
  onAssigneesChange: (assigneeIds: string[]) => void;
  currentUserId: string | null;
  disableZeroCount?: boolean;
}

export function AssigneeFilter({
  profiles,
  tasks,
  selectedAssigneeIds,
  onAssigneesChange,
  currentUserId,
  disableZeroCount = false,
}: AssigneeFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Compute task counts per assignee
  const taskCountByAssignee = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      const key = task.assignee_id ?? ASSIGNEE_FILTER_UNASSIGNED;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [tasks]);

  // Count for "Assigned to me"
  const assignedToMeCount = useMemo(() => {
    if (!currentUserId) return 0;
    return tasks.filter((t) => t.assignee_id === currentUserId).length;
  }, [tasks, currentUserId]);

  // Count for "Unassigned"
  const unassignedCount = taskCountByAssignee.get(ASSIGNEE_FILTER_UNASSIGNED) ?? 0;

  // Filter and sort profiles
  const filteredProfiles = useMemo(() => {
    let filtered = profiles;

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((profile) => {
        const name = (profile.display_name || "").toLowerCase();
        const email = (profile.email || "").toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower);
      });
    }

    // Sort: selected profiles first, then alphabetically
    return [...filtered].sort((a, b) => {
      const aSelected = selectedAssigneeIds.includes(a.id);
      const bSelected = selectedAssigneeIds.includes(b.id);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const nameA = getDisplayName(a);
      const nameB = getDisplayName(b);
      return nameA.localeCompare(nameB);
    });
  }, [profiles, search, selectedAssigneeIds]);

  // Derive selected profiles for trigger display
  const selectedProfiles = useMemo(
    () => profiles.filter((p) => selectedAssigneeIds.includes(p.id)),
    [profiles, selectedAssigneeIds]
  );

  // Count of special filters selected
  const specialFilterCount = useMemo(() => {
    let count = 0;
    if (selectedAssigneeIds.includes(ASSIGNEE_FILTER_ASSIGNED_TO_ME)) count++;
    if (selectedAssigneeIds.includes(ASSIGNEE_FILTER_UNASSIGNED)) count++;
    return count;
  }, [selectedAssigneeIds]);

  const totalSelectedCount = selectedProfiles.length + specialFilterCount;

  const handleToggle = (id: string) => {
    if (selectedAssigneeIds.includes(id)) {
      onAssigneesChange(selectedAssigneeIds.filter((v) => v !== id));
    } else {
      onAssigneesChange([...selectedAssigneeIds, id]);
    }
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onAssigneesChange([]);
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
            totalSelectedCount > 0 && "bg-primary/10 border-primary/30"
          )}
        >
          {totalSelectedCount > 0 ? (
            <>
              {selectedProfiles.length > 0 && (
                <div className="flex -space-x-1.5">
                  {selectedProfiles.slice(0, 3).map((profile) => (
                    <Avatar key={profile.id} size="sm" className="h-4 w-4 ring-2 ring-background">
                      {profile.avatar_url && (
                        <AvatarImage src={profile.avatar_url} alt={getDisplayName(profile)} />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {getProfileInitials(profile)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
              <span>
                {totalSelectedCount === 1 && selectedProfiles.length === 1
                  ? getDisplayName(selectedProfiles[0])
                  : totalSelectedCount === 1 && specialFilterCount === 1
                    ? selectedAssigneeIds.includes(ASSIGNEE_FILTER_ASSIGNED_TO_ME)
                      ? "Assigned to me"
                      : "Unassigned"
                    : `${totalSelectedCount} selected`}
              </span>
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
              <Users className="h-4 w-4" />
              <span>Assignee</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
          {totalSelectedCount > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1">
          {/* All Assignees option */}
          <button
            onClick={() => handleClearAll()}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
              totalSelectedCount === 0 && "bg-muted"
            )}
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left">All Assignees</span>
            {totalSelectedCount === 0 && <Check className="h-4 w-4" />}
          </button>

          {/* Quick filters */}
          <div className="mt-1 border-t pt-1">
            {/* Assigned to me */}
            <button
              onClick={() => handleToggle(ASSIGNEE_FILTER_ASSIGNED_TO_ME)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                selectedAssigneeIds.includes(ASSIGNEE_FILTER_ASSIGNED_TO_ME) && "bg-muted"
              )}
            >
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">Assigned to me</span>
              <span className="text-xs text-muted-foreground tabular-nums">{assignedToMeCount}</span>
              {selectedAssigneeIds.includes(ASSIGNEE_FILTER_ASSIGNED_TO_ME) && (
                <Check className="h-4 w-4" />
              )}
            </button>

            {/* Unassigned */}
            <button
              onClick={() => handleToggle(ASSIGNEE_FILTER_UNASSIGNED)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                selectedAssigneeIds.includes(ASSIGNEE_FILTER_UNASSIGNED) && "bg-muted"
              )}
            >
              <UserX className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">Unassigned</span>
              <span className="text-xs text-muted-foreground tabular-nums">{unassignedCount}</span>
              {selectedAssigneeIds.includes(ASSIGNEE_FILTER_UNASSIGNED) && (
                <Check className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* People list */}
          {filteredProfiles.length > 0 && (
            <div className="mt-1 border-t pt-1">
              {filteredProfiles.map((profile) => {
                const isSelected = selectedAssigneeIds.includes(profile.id);
                const count = taskCountByAssignee.get(profile.id) ?? 0;
                const isDisabled = disableZeroCount && count === 0;

                return (
                  <button
                    key={profile.id}
                    onClick={() => !isDisabled && handleToggle(profile.id)}
                    disabled={isDisabled}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      isDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-muted",
                      isSelected && !isDisabled && "bg-muted"
                    )}
                  >
                    <Avatar size="sm" className="h-5 w-5">
                      {profile.avatar_url && (
                        <AvatarImage src={profile.avatar_url} alt={getDisplayName(profile)} />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {getProfileInitials(profile)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-left">{getDisplayName(profile)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          )}

          {filteredProfiles.length === 0 && search.trim() && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No people found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
