"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  CheckSquare,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus,
  Bell,
} from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectDialog } from "@/components/project";
import { QuickAddTask } from "@/components/task";
import { LandingPage } from "@/components/landing";
import { useAuth } from "@/hooks/use-auth";
import { useProjects, useProjectMutations } from "@/hooks/use-projects";
import { useTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useProfiles } from "@/hooks/use-profiles";
import { useIsMobile } from "@/hooks/use-media-query";
import { useNotifications, useMarkNotificationAsRead } from "@/hooks/use-notifications";
import type { CreateProjectInput, UpdateProjectInput, CreateTaskInput } from "@/lib/validation";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
}

function StatCard({ title, value, icon, href }: StatCardProps) {
  return (
    <Link href={href}>
      <Card className="transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function HomePage() {
  const { user, initialized } = useAuth();

  // Show nothing while auth initializes to avoid flash
  if (!initialized) {
    return null;
  }

  // Show landing page for unauthenticated users
  if (!user) {
    return <LandingPage />;
  }

  // Show dashboard for authenticated users
  return <Dashboard />;
}

function Dashboard() {
  const router = useRouter();
  const { projects, loading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { tasks, loading: tasksLoading, refetch: refetchTasks } = useTasks();
  const { profiles } = useProfiles();
  const { notifications, loading: notificationsLoading } = useNotifications();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const isMobile = useIsMobile();
  const { createProject, loading: mutationLoading } = useProjectMutations();
  const { createTask, loading: taskMutationLoading } = useTaskMutations();
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Calculate stats
  const totalProjects = projects.filter((p) => p.status === "active").length;
  const todoTasks = tasks.filter((t) => t.status === "todo").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  // Handle project creation
  const handleCreateProject = useCallback(
    async (data: CreateProjectInput | UpdateProjectInput) => {
      // When creating, we need all required fields
      await createProject(data as CreateProjectInput);
      refetchProjects();
    },
    [createProject, refetchProjects]
  );

  // Handle quick task creation (from mobile + button)
  const handleQuickAddSubmit = useCallback(
    async (data: CreateTaskInput) => {
      const result = await createTask(data);
      if (result) {
        refetchTasks();
      }
    },
    [createTask, refetchTasks]
  );

  // Handle mobile add button - always opens task creation
  const handleMobileAddTask = useCallback(() => {
    if (isMobile) {
      setShowQuickAdd(true);
    } else {
      setShowProjectDialog(true);
    }
  }, [isMobile]);

  // Handle notification click
  const handleNotificationClick = useCallback((notificationId: string, entityType: string, entityId: string) => {
    // Mark as read
    markAsRead(notificationId);

    // Navigate to entity
    const url = entityType === "task" ? `/tasks/${entityId}` : `/projects/${entityId}`;
    router.push(url);
  }, [markAsRead, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + P to create project
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setShowProjectDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isLoading = projectsLoading || tasksLoading;

  return (
    <AppShell onAddTask={handleMobileAddTask}>
      <Header
        title="Dashboard"
        description="Overview of your projects and tasks"
        onQuickCreate={() => setShowProjectDialog(true)}
        quickCreateLabel="New Project"
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Projects"
            value={totalProjects}
            icon={<FolderKanban className="h-5 w-5 text-muted-foreground" />}
            href="/projects"
          />
          <StatCard
            title="To Do"
            value={todoTasks}
            icon={<CheckSquare className="h-5 w-5 text-muted-foreground" />}
            href="/tasks"
          />
          <StatCard
            title="In Progress"
            value={inProgressTasks}
            icon={<Clock className="h-5 w-5 text-blue-500" />}
            href="/tasks"
          />
          <StatCard
            title="Completed"
            value={doneTasks}
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
            href="/tasks"
          />
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderKanban className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No projects yet
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowProjectDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create your first project
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 5).map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted w-full"
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="flex-1 truncate text-sm font-medium">
                        {project.title}
                      </span>
                      {project.tasks.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {project.tasks.filter(t => t.status === "done").length}/{project.tasks.length} done
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
              {notifications.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {notifications.filter(n => !n.read).length} unread
                </span>
              )}
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No notifications yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You&apos;ll see mentions and updates here
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {notifications.slice(0, 5).map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(
                        notification.id,
                        notification.entity_type,
                        notification.entity_id
                      )}
                      className={`w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted ${
                        !notification.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${
                        notification.read ? "text-muted-foreground" : "text-primary"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${
                          notification.read ? "text-muted-foreground" : "font-medium"
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </button>
                  ))}
                  {notifications.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      + {notifications.length - 5} more notifications
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Project create dialog */}
      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onSubmit={handleCreateProject}
        loading={mutationLoading}
      />

      {/* Quick add task drawer (mobile) */}
      <QuickAddTask
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSubmit={handleQuickAddSubmit}
        projects={projects}
        profiles={profiles}
        loading={taskMutationLoading}
      />
    </AppShell>
  );
}
