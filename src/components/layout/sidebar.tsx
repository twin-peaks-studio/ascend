"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Folder,
  Settings,
  Keyboard,
  PanelLeftClose,
  PanelLeft,
  MessageSquarePlus,
} from "lucide-react";
import { AscendLogo } from "@/components/ascend-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useSidebar } from "@/hooks/use-sidebar";
import type { ProjectWithRelations } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
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

interface SidebarProps {
  onShowShortcuts?: () => void;
  onShowFeedback?: () => void;
}

interface NavLinksProps {
  pathname: string;
  projects: ProjectWithRelations[];
  isCollapsed: boolean;
}

function NavLinks({ pathname, projects, isCollapsed }: NavLinksProps) {
  return (
    <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
      {navItems.map((item) => {
        const isActive =
          item.href === "/projects"
            ? pathname === "/projects"
            : pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isCollapsed && "justify-center px-2",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            title={isCollapsed ? item.label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
      {projects.length > 0 && !isCollapsed && (
        <>
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Your projects
          </div>
          {projects.map((project) => {
            const href = `/projects/${project.id}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={project.id}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Folder className="h-5 w-5 shrink-0" />
                <span className="truncate">{project.title || "Untitled project"}</span>
              </Link>
            );
          })}
        </>
      )}
      {projects.length > 0 && isCollapsed && (
        <div className="pt-2 border-t border-border/40">
          {projects.slice(0, 3).map((project) => {
            const href = `/projects/${project.id}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={project.id}
                href={href}
                className={cn(
                  "flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                title={project.title || "Untitled project"}
              >
                <Folder className="h-5 w-5 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

export function Sidebar({ onShowShortcuts, onShowFeedback }: SidebarProps) {
  const pathname = usePathname();
  const { projects } = useProjects();
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <>
      {/* Sidebar - Desktop only (hidden on tablet and below) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 lg:flex",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-16 items-center gap-2 border-b",
          isCollapsed ? "justify-center px-2" : "px-6"
        )}>
          <AscendLogo className="h-8 w-auto shrink-0" />
          {!isCollapsed && <span className="text-lg font-semibold">Ascend</span>}
        </div>

        {/* Navigation */}
        <NavLinks pathname={pathname} projects={projects} isCollapsed={isCollapsed} />

        {/* Bottom section */}
        <div className="border-t p-4 space-y-2">
          {onShowShortcuts && !isCollapsed && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={onShowShortcuts}
            >
              <Keyboard className="h-5 w-5" />
              Shortcuts
              <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
                ?
              </kbd>
            </Button>
          )}
          {onShowShortcuts && isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-muted-foreground"
              onClick={onShowShortcuts}
              title="Shortcuts"
            >
              <Keyboard className="h-5 w-5" />
            </Button>
          )}
          {onShowFeedback && !isCollapsed && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={onShowFeedback}
            >
              <MessageSquarePlus className="h-5 w-5" />
              Feedback
            </Button>
          )}
          {onShowFeedback && isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-muted-foreground"
              onClick={onShowFeedback}
              title="Send Feedback"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          )}
          {!isCollapsed ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              asChild
            >
              <Link href="/settings">
                <Settings className="h-5 w-5" />
                Settings
              </Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-muted-foreground"
              asChild
              title="Settings"
            >
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          )}

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            className={cn(
              "w-full text-muted-foreground",
              isCollapsed ? "justify-center" : "justify-start gap-3"
            )}
            onClick={toggleSidebar}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
