"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Plus,
  Settings2,
  LayoutGrid,
  List,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ViewMode } from "./header";

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
}

export function MobileBottomNav({ onAddTask, viewMode, onViewModeChange }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);

  // Only show settings button on tasks page
  const showSettingsButton = pathname === "/tasks";

  return (
    <>
      {/* Floating Settings Button - visible on tasks page for mobile/tablet */}
      {showSettingsButton && (
        <button
          onClick={() => setShowSettings(true)}
          className="fixed bottom-28 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-lg ring-1 ring-border/50 transition-transform hover:scale-105 active:scale-95 lg:hidden"
          aria-label="View options"
        >
          <Settings2 className="h-5 w-5" />
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
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle>View Options</SheetTitle>
          </SheetHeader>
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
        </SheetContent>
      </Sheet>
    </>
  );
}
