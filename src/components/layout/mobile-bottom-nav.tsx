"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Search,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export function MobileBottomNav({ onAddTask }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <>
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

            {/* Search Button - Separate Circle */}
            <button
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card/95 text-muted-foreground shadow-lg ring-1 ring-border/50 backdrop-blur-md transition-colors hover:text-foreground dark:bg-card/90"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
