"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Sun,
  Moon,
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  FileText,
  Timer,
  Brain,
  Search,
  Users,
  Smartphone,
  Keyboard,
  ArrowLeft,
  Newspaper,
  ChevronRight,
  GripVertical,
  List,
  Filter,
  BarChart3,
  Sparkles,
  Clock,
  Plus,
  Layers,
  Bell,
  History,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AscendLogo } from "@/components/ascend-logo";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface WikiSection {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  content: WikiContentBlock[];
}

interface WikiContentBlock {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
  tip?: string;
  image?: {
    src: string;
    alt: string;
    caption?: string;
  };
}

const sections: WikiSection[] = [
  {
    id: "getting-started",
    icon: Sparkles,
    title: "Getting Started",
    description: "Everything you need to know to start using Ascend.",
    content: [
      {
        heading: "Welcome to Ascend",
        paragraphs: [
          "Ascend is a modern project and task management application designed to help teams and individuals organize work, track time, and leverage AI to streamline productivity. Whether you're managing a solo project or collaborating with a team, Ascend provides the tools you need in a clean, responsive interface.",
        ],
      },
      {
        heading: "Creating Your Account",
        paragraphs: [
          "Visit the Ascend landing page and click \"Sign up free\" to create your account. You'll need an email address and password. Once registered, you'll land on the Dashboard where you can start creating projects and tasks immediately.",
        ],
      },
      {
        heading: "Quick Start Workflow",
        list: [
          "Create a project to organize related work (e.g., \"Website Redesign\")",
          "Add tasks to your project with priorities and due dates",
          "Use the Kanban board to drag tasks through To Do, In Progress, and Done",
          "Invite team members to collaborate on projects",
          "Track time on tasks to understand where effort goes",
          "Write meeting notes and use AI to extract action items",
        ],
      },
      {
        image: {
          src: "/wiki/landing-page.png",
          alt: "Ascend landing page",
          caption: "The Ascend landing page with dark mode",
        },
      },
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Your home base with an overview of all projects and tasks.",
    content: [
      {
        heading: "Overview",
        paragraphs: [
          "The Dashboard is the first screen you see after logging in. It provides a bird's-eye view of your work with statistics cards, recent projects, and a quick start guide.",
        ],
        image: {
          src: "/wiki/dashboard.png",
          alt: "Dashboard overview with statistics and recent projects",
          caption: "The Dashboard showing active projects, task statistics, and quick start guide",
        },
      },
      {
        heading: "Statistics Cards",
        list: [
          "Active Projects — Count of all projects with \"active\" status. Click to go to Projects page.",
          "To Do — Number of tasks waiting to be started. Click to go to Tasks page.",
          "In Progress — Tasks currently being worked on.",
          "Completed — Tasks that have been finished.",
        ],
      },
      {
        heading: "Recent Projects",
        paragraphs: [
          "Shows your 5 most recent projects with color indicators and completion progress (e.g., \"3/8 done\"). Click any project to go directly to its detail page.",
        ],
      },
      {
        tip: "Press Cmd/Ctrl + P on the Dashboard to quickly create a new project.",
      },
    ],
  },
  {
    id: "tasks",
    icon: CheckSquare,
    title: "Tasks",
    description:
      "Create, organize, sort, and track tasks across all your projects.",
    content: [
      {
        heading: "Task Views",
        paragraphs: [
          "Ascend offers two ways to view your tasks. Switch between them using the toggle in the header.",
        ],
        list: [
          "Kanban Board — Drag-and-drop cards between To Do, In Progress, and Done columns. Great for visual workflow management.",
          "List View — A compact, Todoist-style list with checkboxes for quick status toggling. Shows priority indicators and due dates inline.",
        ],
        image: {
          src: "/wiki/tasks-board.png",
          alt: "Tasks page with board and list view toggles",
          caption: "The Tasks page showing the board/list toggle, project filter, and sort controls",
        },
      },
      {
        heading: "Creating Tasks",
        paragraphs: [
          "Create tasks from the header's \"Create\" button (desktop) or the floating \"+\" button (mobile). Each task has:",
        ],
        image: {
          src: "/wiki/create-task.png",
          alt: "Create task dialog",
          caption: "The task creation dialog with title, description, project, status, priority, due date, and assignee fields",
        },
        list: [
          "Title (required) — A short description of what needs to be done",
          "Description — Additional details in rich text (bold, italic, lists)",
          "Status — To Do, In Progress, or Done",
          "Priority — Low, Medium, High, or Urgent (color-coded)",
          "Assignee — Which team member is responsible",
          "Due Date — When the task should be completed, with optional time-of-day",
          "Project — Which project this task belongs to",
        ],
      },
      {
        heading: "Due Date with Time Picker",
        paragraphs: [
          "When setting a due date, you can also pick a specific time of day. The calendar popover includes a time picker footer where you select hours and minutes. The date and time are saved together when you close the popover.",
          "On mobile, the due date is a first-class field on the task detail page — visible inline between the description and attachments. Tap the due date row to expand an inline calendar with time picker. This avoids burying the date in the properties sheet.",
        ],
        tip: "If a task has both a due date and an assignee, an automatic reminder fires 1 hour before the deadline. You don't need to set a reminder manually.",
      },
      {
        heading: "Sorting Tasks",
        paragraphs: [
          "Sort tasks by multiple criteria using the sort controls. Options include: position (manual order), priority, updated date, status, due date, and title. Sort direction (ascending/descending) can be toggled. Sort preferences are saved per page.",
        ],
      },
      {
        heading: "Filtering Tasks",
        paragraphs: [
          "On the global Tasks page, filter by one or more projects to focus on specific work. Multi-select projects from the filter dropdown. On mobile, filters are integrated into the floating action button's sheet.",
        ],
      },
      {
        heading: "Task Actions",
        list: [
          "Click a task to open its dedicated detail page (/tasks/[id])",
          "Toggle status with the checkbox in list view",
          "Drag and drop to reorder in Kanban view",
          "Delete a task from the detail page (with confirmation)",
          "Archive or mark as duplicate from the task menu",
        ],
      },
      {
        tip: "On mobile, long-press a task card for 300ms before dragging. This prevents accidental reordering while scrolling.",
      },
    ],
  },
  {
    id: "projects",
    icon: FolderKanban,
    title: "Projects",
    description:
      "Organize work into projects with status tracking, team management, and resources.",
    content: [
      {
        heading: "Project List",
        paragraphs: [
          "The Projects page shows all your projects in a responsive grid. Filter projects by status using the tabs: All, Active, Completed, and Archived.",
        ],
        image: {
          src: "/wiki/projects.png",
          alt: "Projects page with status filter tabs",
          caption: "The Projects page with All, Active, Completed, and Archived filter tabs",
        },
      },
      {
        heading: "Creating a Project",
        paragraphs: [
          "Click \"New Project\" to open the creation dialog. Set a title, description, status, priority, color, and due date. You can also assign a project lead and invite team members.",
        ],
      },
      {
        heading: "Project Detail Page",
        paragraphs: [
          "Each project has a rich detail page with collapsible sections:",
        ],
        list: [
          "Active Tasks — Shows the 10 highest-priority tasks. Click \"View All\" to open the project's dedicated task board.",
          "Notes — Quick access to project notes with a link to create new ones.",
          "Resources — Manage links, documents, and note attachments.",
          "Properties Panel — Edit project metadata including status, priority, color, lead, due date, members, and total time tracked.",
        ],
        image: {
          src: "/wiki/project-detail.png",
          alt: "Project detail page with tasks, notes, and properties",
          caption: "The project detail page showing active tasks, notes, resources, and the properties panel",
        },
      },
      {
        heading: "Project Properties",
        list: [
          "Status — Active, Completed, or Archived",
          "Priority — Low, Medium, High, or Urgent",
          "Color — Choose from 8 preset colors for visual identification",
          "Lead — Assign a team member as the project lead",
          "Due Date — Set a project deadline",
          "Members — View count and invite new members",
          "Total Time — Aggregated time tracked across all project tasks",
        ],
      },
      {
        heading: "Project Tasks Page",
        paragraphs: [
          "Each project has its own dedicated tasks page at /projects/[id]/tasks with independent Kanban/list views, sorting, and preferences — separate from the global tasks page.",
        ],
      },
    ],
  },
  {
    id: "notes",
    icon: FileText,
    title: "Notes",
    description:
      "Write meeting notes, link tasks, and extract action items with AI.",
    content: [
      {
        heading: "Overview",
        paragraphs: [
          "Notes live within projects and are designed for meeting notes, planning documents, or any text content that relates to your work. Each note uses a rich WYSIWYG editor powered by TipTap.",
        ],
        image: {
          src: "/wiki/notes.png",
          alt: "Note editor with rich text and linked tasks",
          caption: "A note with rich text formatting, AI task extraction, and linked tasks section",
        },
      },
      {
        heading: "Creating and Editing Notes",
        paragraphs: [
          "Navigate to a project and click \"New Note\" in the Notes section. The editor supports rich text formatting including headings, bold/italic text, lists, and more. Notes auto-save 1.5 seconds after you stop typing — you'll see a \"Saving...\" indicator.",
        ],
      },
      {
        heading: "Linking Tasks to Notes",
        paragraphs: [
          "At the bottom of each note, you'll find a \"Tasks from Note\" section where you can:",
        ],
        list: [
          "Create new tasks directly from the note (they're automatically linked)",
          "View all tasks linked to this note with status toggles",
          "Unlink tasks that are no longer relevant",
        ],
      },
      {
        heading: "AI Task Extraction",
        paragraphs: [
          "Click the \"Extract Tasks with AI\" button on any note to let Claude AI analyze your content. The AI will:",
        ],
        list: [
          "Identify actionable items from your text",
          "Assign priority levels based on urgency language",
          "Suggest due dates if mentioned in the content",
          "Provide a confidence score for each extraction",
          "Skip completed items and avoid duplicating existing tasks",
        ],
      },
      {
        paragraphs: [
          "Extracted tasks appear in a review dialog where you can edit, remove, or approve each one before they're created in your project.",
        ],
      },
      {
        tip: "Write naturally in your notes — the AI understands context. Phrases like \"we need to ship this by Friday\" will be extracted with a due date and higher priority.",
      },
    ],
  },
  {
    id: "time-tracking",
    icon: Timer,
    title: "Time Tracking",
    description:
      "Track time on tasks, view reports, and sync timers across devices.",
    content: [
      {
        heading: "Starting a Timer",
        paragraphs: [
          "Click the play button on any task to start tracking time. A global timer indicator appears in the header showing the active task name and elapsed time. Only one timer can run at a time — starting a new one will stop the current one.",
        ],
        image: {
          src: "/wiki/time-tracking.png",
          alt: "Project detail showing tracked time in the properties panel",
          caption: "Time tracked on a project displayed in the properties panel",
        },
      },
      {
        heading: "Timer Persistence",
        paragraphs: [
          "Active timers are saved to localStorage, so they survive page reloads and browser restarts. The timer also syncs across browser tabs and devices via Supabase Realtime, so you can start a timer on your phone and see it running on your desktop.",
        ],
      },
      {
        heading: "Managing Time Entries",
        paragraphs: [
          "Each task shows a list of time entries. You can:",
        ],
        list: [
          "View all entries with start time, end time, and duration",
          "Manually create entries by specifying start and end times",
          "Edit existing entries to correct mistakes",
          "Delete entries you no longer need",
          "Add descriptions to entries for additional context",
        ],
      },
      {
        heading: "Project Time Reports",
        paragraphs: [
          "In the project properties panel, click \"Time Report\" to see a comprehensive breakdown of time spent on the project. Toggle between two views:",
        ],
        list: [
          "By Day — Time grouped by date to see daily effort patterns",
          "By Task — Time sorted by individual tasks to see where effort went",
        ],
        image: {
          src: "/wiki/time-report.png",
          alt: "Time report dialog showing daily breakdown of time entries by task",
          caption: "The Time Report dialog with By Day view showing daily effort and per-task breakdowns",
        },
      },
      {
        tip: "Click on a task name in the time report to jump directly to that task's details.",
      },
    ],
  },
  {
    id: "ai-features",
    icon: Brain,
    title: "AI Features",
    description:
      "Leverage Claude AI to extract tasks and streamline your workflow.",
    content: [
      {
        heading: "AI Task Extraction",
        paragraphs: [
          "Ascend integrates with Claude AI (Sonnet) to intelligently extract tasks from your notes. This is particularly useful after meetings or brainstorming sessions where action items are mixed with discussion notes.",
        ],
      },
      {
        heading: "How It Works",
        list: [
          "Open any note and click \"Extract Tasks with AI\"",
          "The AI processes your note content, considering the project context and existing tasks",
          "A review dialog appears showing each extracted task with its inferred priority and optional due date",
          "Each task includes a confidence score (0-1) so you can gauge extraction quality",
          "Edit, remove, or approve tasks before they're created",
          "Approved tasks are bulk-created and automatically linked to the source note",
        ],
        image: {
          src: "/wiki/ai-extraction.png",
          alt: "AI task extraction review dialog showing extracted tasks with priorities and confidence scores",
          caption: "The AI extraction review dialog with extracted tasks, confidence scores, priorities, and suggested due dates",
        },
      },
      {
        heading: "Smart Features",
        list: [
          "Duplicate Prevention — The AI checks existing project tasks to avoid creating duplicates",
          "Context Awareness — Considers the project name and description for better extraction",
          "Priority Inference — Urgency language like \"ASAP\", \"critical\", or \"blocking\" results in higher priorities",
          "Date Detection — Dates and deadlines mentioned in text are captured as due dates",
          "Completed Item Filtering — Items described as already done are skipped",
        ],
      },
      {
        tip: "The AI extraction has a 15-second timeout and handles rate limiting gracefully. If the API is busy, you'll see a helpful message to try again.",
      },
    ],
  },
  {
    id: "search",
    icon: Search,
    title: "Search",
    description:
      "Find any task or project instantly with global fuzzy search.",
    content: [
      {
        heading: "Global Search",
        paragraphs: [
          "Press Cmd/Ctrl + K (or click the search icon in the header) to open the search dialog. Search across all your tasks and projects with instant fuzzy matching.",
        ],
      },
      {
        heading: "Search Results",
        list: [
          "Tasks — Up to 10 matching tasks, showing the task title and associated project",
          "Projects — Up to 5 matching projects",
          "Click any result to navigate directly to that task or project",
        ],
      },
      {
        heading: "Access Control",
        paragraphs: [
          "Search results only include items you have access to — tasks you created and projects where you're a member.",
        ],
      },
    ],
  },
  {
    id: "collaboration",
    icon: Users,
    title: "Team Collaboration",
    description: "Invite team members, assign work, and collaborate on projects.",
    content: [
      {
        heading: "Inviting Members",
        paragraphs: [
          "Open a project's properties panel and click the invite button next to the member count. Send email invitations to bring team members into your project.",
        ],
      },
      {
        heading: "Roles",
        list: [
          "Owner — Full control over the project including settings, member management, and deletion",
          "Member — Can view the project, create and manage tasks, write notes, and track time",
        ],
      },
      {
        heading: "Task Assignment",
        paragraphs: [
          "Assign tasks to any project member from the task details dialog. The assignee dropdown only shows members of the relevant project, preventing accidental assignment to non-members. When creating tasks, the current user is auto-populated as the default assignee.",
        ],
      },
      {
        heading: "Project Lead",
        paragraphs: [
          "Designate a project lead from the properties panel. The lead dropdown is also filtered to project members only.",
        ],
      },
      {
        heading: "Comments",
        paragraphs: [
          "Every task has a comment section where team members can discuss work. Comments appear in chronological order and support real-time updates via Supabase Realtime.",
        ],
      },
      {
        heading: "@Mentions",
        paragraphs: [
          "Inside a shared project task's comment box, type @ to trigger the mention dropdown. The list shows all project members (excluding yourself), filtered as you type. Select a member with the mouse, or use the arrow keys and press Enter. The mentioned user's name is inserted into your comment text.",
          "When you submit the comment, the mentioned user receives an instant notification in their notification center.",
        ],
        tip: "Mentions are only available on tasks that belong to a shared project with at least two members.",
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    description: "Stay informed with real-time alerts for mentions, assignments, and project changes.",
    content: [
      {
        heading: "Notification Center",
        paragraphs: [
          "The bell icon in the header is your notification center. A badge shows how many unread notifications you have. Click the bell to open a dropdown listing all recent notifications.",
          "Each notification shows who triggered it, what happened, and when. Click a notification to navigate directly to the relevant task or project. Use \"Mark all read\" to clear all unread badges at once.",
        ],
      },
      {
        heading: "Notification Types",
        list: [
          "Mentioned you in a comment — Someone @mentioned you in a task comment",
          "Assigned a task to you — Someone assigned you to a task",
          "Removed you from a task — Someone changed a task's assignee away from you",
          "Invited you to a project — Someone added you as a project member",
          "Made you lead of a project — Someone designated you as project lead",
          "Removed you as project lead — Someone changed the project lead to someone else",
          "Task due reminder — An automatic reminder fires 1 hour before a task's due date",
          "Project due reminder — An automatic reminder fires 1 hour before a project's due date (sent to the project lead)",
        ],
      },
      {
        heading: "Due Date Reminders",
        paragraphs: [
          "When a task has both a due date and an assignee, a background reminder is scheduled to fire 1 hour before the deadline. This happens automatically — you do not need to set a reminder manually.",
          "If you complete or delete the task, or change the due date, the pending reminder is automatically cancelled. If the assignee changes, the reminder is rescheduled for the new assignee.",
          "Projects also support due date reminders. When a project has a due date and a designated lead, the project lead receives a reminder 1 hour before the deadline. Completing, archiving, or deleting the project cancels the pending reminder.",
        ],
        tip: "Due date reminders are powered by Inngest, a durable workflow engine. They work even if you have not opened the app — the notification will be waiting for you when you return.",
      },
      {
        heading: "Real-Time Delivery",
        paragraphs: [
          "Notifications are delivered instantly via Supabase Realtime. You do not need to refresh the page — the bell badge updates automatically the moment another user triggers a notification for you.",
        ],
        tip: "You will never receive a notification for your own actions. If you assign a task to yourself, no notification is created.",
      },
    ],
  },
  {
    id: "activity-feed",
    icon: History,
    title: "Activity Feed",
    description: "A chronological audit trail of all changes within a project.",
    content: [
      {
        heading: "Overview",
        paragraphs: [
          "The Activity Feed is a per-project log of everything that happens — task changes, note edits, comments, member updates, and project edits. It answers the question \"what did I miss?\" and provides an audit trail for accountability.",
          "Open any project, scroll to the bottom of the left panel, and expand the Activity section to see the 50 most recent entries, newest first.",
        ],
      },
      {
        heading: "What Gets Logged",
        list: [
          "Task created — A new task is added to the project",
          "Task status changed — A task moves between To Do, In Progress, and Done (shows before/after values)",
          "Task priority changed — A task's priority is updated (shows before/after values)",
          "Task assigned — A task's assignee changes",
          "Task deleted — A task is removed from the project (title preserved in log)",
          "Note created — A new note is added to the project",
          "Note updated — A note's title or content is modified",
          "Note deleted — A note is removed from the project (title preserved in log)",
          "Comment added — A comment is posted on a project task",
          "Member added — Shows who was added to the project by name",
          "Member removed — Shows who was removed from the project by name",
          "Project updated — Shows before/after values for title, status, priority, lead, and due date changes",
        ],
      },
      {
        heading: "Viewing the Feed",
        paragraphs: [
          "The Activity section is collapsed by default on the project page. Click the Activity header to expand it. Each entry shows the action icon, who performed the action, a human-readable description, and a relative timestamp (e.g., \"2h ago\").",
          "Clickable entries: Task and note activity entries are clickable — click one to navigate directly to the task or note. Deleted items are not clickable since the target no longer exists.",
          "The feed displays the 50 most recent entries in a scrollable area. Activity entries are logged automatically by database triggers — no manual action is needed.",
        ],
      },
      {
        heading: "Real-Time Updates",
        paragraphs: [
          "The activity feed updates in real time via Supabase Realtime. When a teammate makes a change, the new entry appears automatically without refreshing the page.",
        ],
        tip: "Activity entries persist even when the original item is deleted. For example, if a task is deleted, the \"task deleted\" entry still shows the task title in the log.",
      },
    ],
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "Mobile Experience",
    description: "A fully responsive experience optimized for every screen size.",
    content: [
      {
        heading: "Mobile Navigation",
        paragraphs: [
          "On mobile and tablet devices (below the lg breakpoint), the sidebar is replaced with a bottom navigation bar featuring a floating action button for quick task creation.",
        ],
      },
      {
        heading: "Mobile-Optimized Features",
        list: [
          "Bottom sheets replace side panels for task details and project properties",
          "Floating action button for creating tasks and accessing filters",
          "Combined filter/sort sheet instead of separate controls",
          "Long-press to drag tasks (prevents accidental reordering while scrolling)",
          "Full-screen note editor with auto-save",
          "Touch-optimized hit areas for all interactive elements",
        ],
      },
      {
        heading: "Mobile Backgrounding Recovery",
        paragraphs: [
          "When you background the app (e.g., switch to another app on your phone), Ascend automatically recovers your session when you return. Auth state is refreshed, stale data is refetched, and active timers continue running correctly.",
        ],
      },
    ],
  },
  {
    id: "keyboard-shortcuts",
    icon: Keyboard,
    title: "Keyboard Shortcuts",
    description: "Navigate faster with keyboard shortcuts.",
    content: [
      {
        heading: "Available Shortcuts",
        list: [
          "Cmd/Ctrl + K — Open global search or quick create task",
          "Cmd/Ctrl + P — Quick create project (from Dashboard)",
          "Cmd/Ctrl + / — Show keyboard shortcuts dialog",
          "? — Show keyboard shortcuts dialog (alternative)",
          "Escape — Close any open dialog or cancel current action",
        ],
      },
      {
        tip: "Press ? from any page to see the full shortcuts dialog with all available key combinations.",
      },
    ],
  },
];

function SideNav({
  activeSection,
  onSectionClick,
}: {
  activeSection: string;
  onSectionClick: (id: string) => void;
}) {
  return (
    <nav className="space-y-1">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{section.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileNavDropdown({
  activeSection,
  onSectionClick,
}: {
  activeSection: string;
  onSectionClick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = sections.find((s) => s.id === activeSection);
  const ActiveIcon = active?.icon || Sparkles;

  return (
    <div className="lg:hidden sticky top-16 z-30 bg-background border-b border-border/50 px-4 py-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <ActiveIcon className="h-4 w-4" />
          {active?.title || "Select section"}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 transition-transform",
            open && "rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card p-2 shadow-lg">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  onSectionClick(section.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {section.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WikiPage() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

  // Handle hash on initial load
  // Valid use: reading browser state (window.location) on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && sections.some((s) => s.id === hash)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSection(hash);
      setTimeout(() => {
        sectionRefs.current[hash]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  // Intersection observer to update active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
    );

    for (const section of sections) {
      const el = sectionRefs.current[section.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                Wiki
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/changelog">
                  <Newspaper className="h-4 w-4 mr-1.5" />
                  Changelog
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
      <section className="pt-28 pb-8 sm:pt-32 sm:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ascend
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Wiki
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Learn how to use every feature of Ascend. From basic task management
            to AI-powered workflows — this guide covers it all.
          </p>
        </div>
      </section>

      {/* Mobile section nav */}
      <MobileNavDropdown
        activeSection={activeSection}
        onSectionClick={scrollToSection}
      />

      {/* Content with sidebar */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-10">
            {/* Desktop side nav */}
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-24">
                <SideNav
                  activeSection={activeSection}
                  onSectionClick={scrollToSection}
                />
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0 max-w-3xl">
              <div className="space-y-16">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <article
                      key={section.id}
                      id={section.id}
                      ref={(el) => {
                        sectionRefs.current[section.id] = el;
                      }}
                      className="scroll-mt-28"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                          {section.title}
                        </h2>
                      </div>
                      <p className="text-muted-foreground mb-8 leading-relaxed">
                        {section.description}
                      </p>

                      <div className="space-y-8">
                        {section.content.map((block, i) => (
                          <div key={i}>
                            {block.heading && (
                              <h3 className="text-lg font-semibold mb-3">
                                {block.heading}
                              </h3>
                            )}
                            {block.paragraphs?.map((p, j) => (
                              <p
                                key={j}
                                className="text-sm text-muted-foreground leading-relaxed mb-3"
                              >
                                {p}
                              </p>
                            ))}
                            {block.list && (
                              <ul className="space-y-2 ml-1">
                                {block.list.map((item, j) => (
                                  <li
                                    key={j}
                                    className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed"
                                  >
                                    <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {block.tip && (
                              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                                <p className="text-sm leading-relaxed">
                                  <span className="font-semibold text-primary">
                                    Tip:{" "}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {block.tip}
                                  </span>
                                </p>
                              </div>
                            )}
                            {block.image && (
                              <figure className="mt-6">
                                <div className="overflow-hidden rounded-lg border border-border/60 shadow-sm">
                                  <img
                                    src={block.image.src}
                                    alt={block.image.alt}
                                    className="w-full h-auto"
                                    loading="lazy"
                                  />
                                </div>
                                {block.image.caption && (
                                  <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                                    {block.image.caption}
                                  </figcaption>
                                )}
                              </figure>
                            )}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AscendLogo className="h-6 w-auto" />
              <span className="text-sm font-medium">Ascend</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/changelog"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Changelog
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
