"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sun,
  Moon,
  Timer,
  Brain,
  FileText,
  Search,
  List,
  Filter,
  Zap,
  ArrowLeft,
  BookOpen,
  Sparkles,
  BarChart3,
  Layers,
  GripVertical,
  Smartphone,
  Shield,
  Users,
  Clock,
  CheckCircle2,
  Trash2,
  MessageSquarePlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AscendLogo } from "@/components/ascend-logo";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  description: string;
  features: {
    icon: LucideIcon;
    title: string;
    description: string;
    tag?: "new" | "improved" | "fix";
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    date: "February 9, 2026",
    version: "0.9.1",
    title: "Task Editing Fix",
    description:
      "Fixed a bug where editing task title or description on the task detail page had no effect.",
    features: [
      {
        icon: CheckCircle2,
        title: "Task Edit Bug Fix",
        description:
          "Fixed an issue where typing in the title or description fields on the task detail page would immediately revert changes. The render-time state sync was overwriting user input on every keystroke.",
        tag: "fix",
      },
    ],
  },
  {
    date: "February 5, 2026",
    version: "0.9.0",
    title: "Landing Page & Polish",
    description:
      "A brand-new public landing page for visitors, along with dark mode fixes and auth performance improvements.",
    features: [
      {
        icon: Sparkles,
        title: "Public Landing Page",
        description:
          "New marketing-style landing page for unauthenticated visitors with hero section, feature cards, how-it-works flow, and call-to-action buttons. Dark mode supported out of the box.",
        tag: "new",
      },
      {
        icon: Shield,
        title: "Dark Mode Persistence Fix",
        description:
          "Theme state is now managed globally via ThemeContext in AppShell, ensuring dark mode persists correctly across all pages including project detail views.",
        tag: "fix",
      },
      {
        icon: Zap,
        title: "Auth Performance Boost",
        description:
          "Profile fetch on sign-in is now non-blocking, reducing initial page load from 6-7 seconds to near-instant.",
        tag: "improved",
      },
    ],
  },
  {
    date: "February 4, 2026",
    version: "0.8.0",
    title: "Time Reports, Cross-Tab Sync & Sorting",
    description:
      "Major enhancements to time tracking, a new WYSIWYG editor, and comprehensive task sorting across all views.",
    features: [
      {
        icon: BarChart3,
        title: "Project Time Report",
        description:
          "New time tracking report in the project properties panel. View time breakdowns grouped by day or sorted by individual task to understand where effort is going.",
        tag: "new",
      },
      {
        icon: Timer,
        title: "Cross-Tab Timer Sync",
        description:
          "Active timers now synchronize in real-time across browser tabs and devices using Supabase Realtime and the BroadcastChannel API. Start a timer on one tab, see it running on another.",
        tag: "new",
      },
      {
        icon: List,
        title: "Task Sorting",
        description:
          "Sort tasks by due date, priority, status, title, or updated date across all task views. Sort preferences are persisted to localStorage per page.",
        tag: "new",
      },
      {
        icon: Smartphone,
        title: "Mobile Sorting UX",
        description:
          "Sorting is integrated into the existing mobile filter sheet instead of a separate component, combining sort, view mode, and project filter into one cohesive panel.",
        tag: "improved",
      },
      {
        icon: FileText,
        title: "WYSIWYG Rich Text Editor",
        description:
          "Replaced the markdown editor with a TipTap-powered WYSIWYG rich text editor for notes. Format text, add headings, lists, and more — all inline.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 3, 2026",
    version: "0.7.0",
    title: "AI Task Extraction & Time Tracking",
    description:
      "Two headline features: AI-powered task extraction from notes and a full time tracking system with persistent timers.",
    features: [
      {
        icon: Brain,
        title: "AI Task Extraction",
        description:
          "Extract actionable tasks from any note using Claude AI. The system analyzes your note content, identifies action items with priority levels and due dates, and presents them in a review dialog before creation. Includes duplicate prevention and confidence scoring.",
        tag: "new",
      },
      {
        icon: Timer,
        title: "Time Tracking System",
        description:
          "Full time tracking with start/stop timer buttons on tasks, a global timer indicator in the header, time entry management with create/edit/delete, and localStorage persistence so your timer survives page reloads.",
        tag: "new",
      },
      {
        icon: FileText,
        title: "Notes Cursor Fix",
        description:
          "Fixed an issue where the cursor would jump to the end of the document during auto-save. Editing notes is now smooth and uninterrupted.",
        tag: "fix",
      },
      {
        icon: Users,
        title: "Smart Defaults",
        description:
          "Task creation now auto-populates the assignee (current user) and project context, reducing clicks for the most common workflow.",
        tag: "improved",
      },
    ],
  },
  {
    date: "February 2, 2026",
    version: "0.6.0",
    title: "React Query Migration & Performance",
    description:
      "A major architectural upgrade replacing manual data fetching with React Query, dramatically reducing network requests.",
    features: [
      {
        icon: Zap,
        title: "React Query Migration",
        description:
          "Replaced all manual fetch/retry/abort logic with React Query. Navigation requests dropped from 252 to 5-9 per page. Automatic request deduplication, caching, and background refetching.",
        tag: "improved",
      },
      {
        icon: Smartphone,
        title: "Mobile Backgrounding Recovery",
        description:
          "Centralized recovery system that handles returning from mobile background state with health checks, session refresh, and a mutation queue to prevent data loss.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 1, 2026",
    version: "0.5.0",
    title: "Notes, Search, List View & More",
    description:
      "A massive feature release including meeting notes, global search, list view, multi-project filtering, and many UX improvements.",
    features: [
      {
        icon: FileText,
        title: "Meeting Notes",
        description:
          "Create rich meeting notes within projects. Notes support task linking — create tasks directly from a note, or link existing tasks. Each note shows its linked tasks with status toggles.",
        tag: "new",
      },
      {
        icon: Search,
        title: "Global Search",
        description:
          "Search across all tasks and projects with Cmd/Ctrl+K. Fuzzy matching on titles with instant results. Navigate directly to any task or project from the search results.",
        tag: "new",
      },
      {
        icon: List,
        title: "List View",
        description:
          "New Todoist-style list view alternative to the Kanban board. Features priority circles, inline status toggles, and a clean compact layout. Toggle between board and list from the header.",
        tag: "new",
      },
      {
        icon: Filter,
        title: "Multi-Project Filter",
        description:
          "Filter your global task list by one or more projects simultaneously. Combined with sorting, this gives full control over which tasks you see and how they're organized.",
        tag: "new",
      },
      {
        icon: Layers,
        title: "Dedicated Project Tasks Page",
        description:
          'New /projects/[id]/tasks route with its own Kanban/list views, sorting, and preferences. Access it via the "View All" button on the project detail page.',
        tag: "new",
      },
      {
        icon: Trash2,
        title: "Task Deletion",
        description:
          "Delete tasks from the details dialog on both desktop and mobile. Uses optimistic updates for instant feedback with a confirmation step to prevent accidents.",
        tag: "new",
      },
      {
        icon: MessageSquarePlus,
        title: "In-App Feedback",
        description:
          "Send feedback directly from the sidebar or user menu. Submissions create a task in the Ascend project for the team to triage.",
        tag: "new",
      },
      {
        icon: Users,
        title: "Assignee Filtering",
        description:
          "Task assignee dropdowns and project lead selection now show only members of the relevant project, preventing accidental assignment to non-members.",
        tag: "improved",
      },
      {
        icon: GripVertical,
        title: "Long-Press Drag (Mobile)",
        description:
          "On mobile, tasks now require a 300ms long press before dragging begins. This prevents accidental reordering when scrolling through your board.",
        tag: "improved",
      },
      {
        icon: CheckCircle2,
        title: "Task Creator Info",
        description:
          "Task details now display who created the task, giving better context on task origin in team projects.",
        tag: "improved",
      },
    ],
  },
  {
    date: "January 31, 2026",
    version: "0.1.0",
    title: "Initial Release",
    description:
      "The first release of Ascend — a complete project management application with Kanban boards, projects, responsive layout, and dark mode.",
    features: [
      {
        icon: Layers,
        title: "Kanban Board",
        description:
          "Drag-and-drop task board with To Do, In Progress, and Done columns. Fully responsive across desktop, tablet, and mobile.",
        tag: "new",
      },
      {
        icon: Clock,
        title: "Project Management",
        description:
          "Create and manage projects with status tracking, priority levels, color coding, team members, and due dates.",
        tag: "new",
      },
      {
        icon: Smartphone,
        title: "Responsive Design",
        description:
          "Desktop sidebar, tablet-optimized views, and mobile bottom navigation with floating action buttons. Built for every screen size.",
        tag: "new",
      },
      {
        icon: Moon,
        title: "Dark Mode",
        description:
          "Full dark mode support with system preference detection and manual toggle. All components and charts adapt to the selected theme.",
        tag: "new",
      },
    ],
  },
];

function TagBadge({ tag }: { tag: "new" | "improved" | "fix" }) {
  const styles = {
    new: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    improved:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    fix: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[tag]}`}
    >
      {tag === "new" ? "New" : tag === "improved" ? "Improved" : "Fix"}
    </span>
  );
}

export default function ChangelogPage() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDark(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                <AscendLogo className="h-8 w-auto" />
                <span className="text-lg font-semibold tracking-tight">
                  Ascend
                </span>
              </Link>
              <span className="text-border">|</span>
              <span className="text-sm font-medium text-muted-foreground">
                Changelog
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/wiki">
                  <BookOpen className="h-4 w-4 mr-1.5" />
                  Wiki
                </Link>
              </Button>
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-28 pb-12 sm:pt-32 sm:pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ascend
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Changelog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Stay up to date with the latest features, improvements, and fixes in
            Ascend.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {changelog.map((entry, i) => (
              <article key={entry.version} className="relative">
                {/* Version header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-semibold">
                    v{entry.version}
                  </span>
                  <time className="text-sm text-muted-foreground">
                    {entry.date}
                  </time>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  {entry.title}
                </h2>
                <p className="text-muted-foreground mb-8 max-w-2xl leading-relaxed">
                  {entry.description}
                </p>

                {/* Feature grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {entry.features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={feature.title}
                        className="group rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-border hover:shadow-sm"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold">
                                {feature.title}
                              </h3>
                              {feature.tag && <TagBadge tag={feature.tag} />}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Separator line between entries */}
                {i < changelog.length - 1 && (
                  <div className="mt-16 border-t border-border/50" />
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AscendLogo className="h-6 w-auto" />
              <span className="text-sm font-medium">Ascend</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/wiki"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Wiki
              </Link>
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Ascend. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
