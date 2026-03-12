"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Folder,
  Settings,
  PanelLeftClose,
  PanelLeft,
  MessageSquarePlus,
  Newspaper,
  CalendarDays,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useSidebar } from "@/hooks/use-sidebar";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
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
    href: "/today",
    label: "Today",
    icon: CalendarDays,
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
  onShowFeedback?: () => void;
  onAiCreate?: () => void;
}

interface NavLinksProps {
  pathname: string;
  projects: ProjectWithRelations[];
  isCollapsed: boolean;
  isIntelligence: boolean;
}

function NavLinks({ pathname, projects, isCollapsed, isIntelligence }: NavLinksProps) {
  // Build nav items dynamically based on workspace type
  const allNavItems = [
    ...navItems,
    ...(isIntelligence
      ? [{ href: "/captures", label: "Captures", icon: BookOpen }]
      : []),
  ];
  return (
    <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
      {allNavItems.map((item) => {
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

export function Sidebar({ onShowFeedback, onAiCreate }: SidebarProps) {
  const pathname = usePathname();
  const { projects } = useProjects();
  const activeProjects = projects.filter((p) => p.status !== "archived");
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { isIntelligence } = useWorkspaceContext();

  return (
    <>
      {/* Sidebar - Desktop only (hidden on tablet and below) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 lg:flex",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Workspace Switcher */}
        <div className={cn(
          "flex h-16 items-center border-b",
          isCollapsed ? "justify-center px-2" : "px-4"
        )}>
          <WorkspaceSwitcher isCollapsed={isCollapsed} />
        </div>

        {/* Navigation */}
        <NavLinks pathname={pathname} projects={activeProjects} isCollapsed={isCollapsed} isIntelligence={isIntelligence} />

        {/* Bottom section */}
        <div className="border-t p-4 space-y-2">
          {!isCollapsed ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              asChild
            >
              <a href="/changelog" target="_blank" rel="noopener noreferrer">
                <Newspaper className="h-5 w-5" />
                Changelog
              </a>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-muted-foreground"
              asChild
              title="Changelog"
            >
              <a href="/changelog" target="_blank" rel="noopener noreferrer">
                <Newspaper className="h-5 w-5" />
              </a>
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

          {/* Create with AI (beta) — desktop only */}
          {!isCollapsed ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={() => onAiCreate?.()}
            >
              <Sparkles className="h-5 w-5 shrink-0" />
              <span className="flex items-center gap-1.5">
                Create with AI
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full leading-none">
                  beta
                </span>
              </span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-muted-foreground"
              onClick={() => onAiCreate?.()}
              title="Create with AI (beta)"
            >
              <Sparkles className="h-5 w-5" />
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
