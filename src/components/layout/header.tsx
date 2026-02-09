"use client";

import { Moon, Sun, Plus, LogOut, LayoutGrid, List, Search, MessageSquarePlus, Newspaper } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GlobalTimerIndicator } from "@/components/time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/profile-utils";
import { useSearchDialog, useFeedbackDialog, useTheme } from "./app-shell";

export type ViewMode = "board" | "list";

interface HeaderProps {
  title: string;
  description?: string;
  onQuickCreate?: () => void;
  quickCreateLabel?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function Header({
  title,
  description,
  onQuickCreate,
  quickCreateLabel = "Create",
  viewMode,
  onViewModeChange,
}: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const { openSearch } = useSearchDialog();
  const { openFeedback } = useFeedbackDialog();
  const { isDark, toggleTheme, mounted } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side - Title */}
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          {viewMode && onViewModeChange && (
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
              className="hidden sm:flex"
            >
              <ToggleGroupItem value="board" aria-label="Board view" className="h-9 w-9 p-0">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view" className="h-9 w-9 p-0">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {/* Quick create button (hidden on mobile; use bottom nav + instead) */}
          {onQuickCreate && (
            <Button
              onClick={onQuickCreate}
              size="sm"
              className="hidden gap-2 md:inline-flex"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{quickCreateLabel}</span>
            </Button>
          )}

          {/* Global timer indicator */}
          <GlobalTimerIndicator className="hidden sm:flex" />

          {/* Notifications */}
          <NotificationBell />

          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={openSearch}
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>

          {/* User menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {getInitials(profile?.display_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.display_name || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {mounted && isDark ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  <span>{mounted && isDark ? "Light mode" : "Dark mode"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openFeedback} className="cursor-pointer">
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  <span>Send Feedback</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <a href="/changelog" target="_blank" rel="noopener noreferrer">
                    <Newspaper className="mr-2 h-4 w-4" />
                    <span>Changelog</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
