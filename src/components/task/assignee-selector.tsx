"use client";

import { UserCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/types";
import { getProfileInitials, getDisplayName } from "@/lib/profile-utils";

interface AssigneeSelectorProps {
  value?: string | null;
  onChange: (userId: string | null) => void;
  profiles: Profile[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Sentinel value for "unassigned" since SelectItem cannot have empty string
const UNASSIGNED_VALUE = "__unassigned__";

export function AssigneeSelector({
  value,
  onChange,
  profiles,
  placeholder = "Assign to...",
  disabled = false,
  className,
}: AssigneeSelectorProps) {
  // Empty state when no profiles exist
  if (profiles.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <UserCircle className="h-4 w-4" />
        <span>No team members available</span>
      </div>
    );
  }

  const selectedProfile = value
    ? profiles.find((p) => p.id === value)
    : null;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleValueChange = (val: string) => {
    // Convert sentinel value back to null
    onChange(val === UNASSIGNED_VALUE ? null : val);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        value={value || UNASSIGNED_VALUE}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selectedProfile ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedProfile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getProfileInitials(selectedProfile)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{getDisplayName(selectedProfile)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED_VALUE}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCircle className="h-4 w-4" />
              <span>Unassigned</span>
            </div>
          </SelectItem>
          {profiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getProfileInitials(profile)}
                  </AvatarFallback>
                </Avatar>
                <span>{getDisplayName(profile)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedProfile && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleClear}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear assignee</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Compact assignee display for cards
 */
export function AssigneeAvatar({
  profile,
  className,
}: {
  profile: Profile | null | undefined;
  className?: string;
}) {
  if (!profile) return null;

  return (
    <Avatar className={cn("h-6 w-6", className)} title={getDisplayName(profile)}>
      <AvatarImage src={profile.avatar_url || undefined} />
      <AvatarFallback className="text-xs">{getProfileInitials(profile)}</AvatarFallback>
    </Avatar>
  );
}
