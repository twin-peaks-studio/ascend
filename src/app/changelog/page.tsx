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
  Bell,
  Calendar,
  Combine,
  History,
  StickyNote,
  MousePointerClick,
  RefreshCw,
  Eye,
  CalendarDays,
  FolderX,
  ClipboardList,
  Paperclip,
  KeyRound,
  PanelRight,
  Package,
  CheckSquare,
  Network,
  Keyboard,
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
    date: "March 16, 2026",
    version: "0.22.0",
    title: "Product Labels + Task Rollup on Entity Pages",
    description: "Every task now shows which product it belongs to. Entity detail pages show task progress across linked initiatives and projects.",
    features: [
      {
        icon: Package,
        title: "Product Labels on Tasks",
        description: "Tasks linked to a product (via their project's entity) now display a purple product badge. Visible on the global tasks page, project tasks, kanban boards, the Today page, and note/capture task lists.",
        tag: "new",
      },
      {
        icon: CheckSquare,
        title: "Task Rollup on Entity Pages",
        description: "Product entity pages now show task progress for each linked initiative — with a progress bar and status breakdown. Initiative entity pages show their project's active tasks directly.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 16, 2026",
    version: "0.21.1",
    title: "Fix — Stale Tasks After AI Extraction & Deletion on Notes",
    description: "Fixed cache invalidation bugs where deleting an AI-extracted task from a note left stale data on the note page and project tasks page.",
    features: [
      {
        icon: Trash2,
        title: "Task Deletion Syncs Note Cache",
        description: "Deleting a task that was linked to a note now correctly removes it from the note's task list. Previously, navigating back to the note would still show the deleted task until a hard refresh.",
        tag: "fix",
      },
      {
        icon: RefreshCw,
        title: "AI-Extracted Tasks Appear Immediately",
        description: "After AI task extraction creates tasks on a note, the project page's active task counter and task list now update immediately. Previously, newly created tasks wouldn't appear on the project page until a hard refresh or ~30 second cache expiry.",
        tag: "fix",
      },
    ],
  },
  {
    date: "March 16, 2026",
    version: "0.21.0",
    title: "Mobile Navigation — Workspaces First",
    description: "The mobile bottom nav now shows Workspaces instead of Projects, reflecting the natural flow of navigating to a workspace first, then viewing its projects.",
    features: [
      {
        icon: Smartphone,
        title: "Workspaces in Mobile Nav",
        description: "The mobile bottom navigation bar now links to Workspaces instead of Projects. Tap 'Spaces' to see all your workspaces, then select one to view its projects.",
        tag: "improved",
      },
      {
        icon: Layers,
        title: "Workspaces List Page",
        description: "A new /workspaces page shows all your workspaces in a simple grid. Tap any workspace to navigate to its detail page with projects, captures, and entities.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 14, 2026",
    version: "0.20.0",
    title: "New — Entity System: Workspace Tabs for Products, Entities & Captures",
    description: "Captures now have the full note experience: rich text editor, linked tasks, and AI task extraction. Entity detail pages include a Journal tab. Navigation between workspaces, projects, and entities works correctly in both directions.",
    features: [
      {
        icon: Network,
        title: "Entity & Product Tabs in Workspace",
        description: "Intelligence workspaces now show Captures, Products, and Entities tabs when you click a workspace in the sidebar. Browse all entities grouped by type with search and filter, or view only products. Click any entity to see its detail page.",
        tag: "new",
      },
      {
        icon: BookOpen,
        title: "Entity Journal (Brain Dump)",
        description: "Each entity detail page now has a Journal tab for recording evolving knowledge. Add timestamped context entries about any product, initiative, or stakeholder. Journal entries will be synthesized into AI memory alongside foundational context during memory refresh.",
        tag: "new",
      },
      {
        icon: ArrowLeft,
        title: "Workspace-Aware Navigation",
        description: "Clicking a project or entity from a workspace now preserves the back-navigation link. The 'Back' button correctly returns you to the workspace you came from, not to a global page.",
        tag: "improved",
      },
      {
        icon: Layers,
        title: "Product Linkage in Project Properties",
        description: "Projects that have been migrated to the entity system now show a Products section in the properties sidebar. Add or remove product links with multi-select pills — no need to go back to the migration tool.",
        tag: "new",
      },
      {
        icon: FileText,
        title: "Captures: Full Note Experience",
        description: "Captures now have the same rich editing experience as project notes: Tiptap rich text editor with auto-save, linked tasks section, inline task creation, and AI task extraction. Each extracted task can be assigned to a different project.",
        tag: "improved",
      },
    ],
  },
  {
    date: "March 8, 2026",
    version: "0.19.1",
    title: "Fix — Feedback Forms: Submit Another Report & Submission Rate Limit",
    description: "Fixed a bug where 'Submit another report' did nothing after completing a submission, and raised the per-IP submission rate limit to accommodate active testing sessions.",
    features: [
      {
        icon: RefreshCw,
        title: "\"Submit Another Report\" Now Works",
        description: "After completing a submission and follow-up chat, clicking 'Submit another report' now correctly resets to a blank form. Previously, navigating to the same URL was a no-op in Next.js and the button had no effect.",
        tag: "fix",
      },
      {
        icon: Shield,
        title: "Submission Rate Limit Raised to 50/hour",
        description: "The per-IP feedback submission rate limit has been increased from 10 to 50 submissions per hour to avoid false positives during active test sessions.",
        tag: "improved",
      },
    ],
  },
  {
    date: "March 8, 2026",
    version: "0.19.0",
    title: "Improved — Feedback Forms: Attachments, Detail View & Richer Task Descriptions",
    description: "Testers can now attach files to submissions, click any tracker card to see full task details, and each submitted task now carries a structured three-section description that preserves the original report verbatim.",
    features: [
      {
        icon: Paperclip,
        title: "File Attachments on Submissions",
        description: "Every feedback form now includes an optional file attachment section. Testers can drag-and-drop or browse to attach screenshots, logs, or any other files (up to 10 MB each). Attachments appear on the created Ascend task and are downloadable from the tester tracker.",
        tag: "new",
      },
      {
        icon: PanelRight,
        title: "Clickable Tracker Cards with Detail View",
        description: "Each card or row in the tester issue tracker is now clickable. Clicking opens a slide-over panel showing the full task: title, status, priority, submission date, formatted description with all three sections, and a downloadable attachment list.",
        tag: "new",
      },
      {
        icon: Sparkles,
        title: "Three-Section Task Descriptions",
        description: "Task descriptions created from feedback submissions now have three distinct sections: (1) the original user input, verbatim and never modified by AI; (2) an AI summary interpreting the full report; and (3) additional context from any follow-up Q&A answers.",
        tag: "improved",
      },
      {
        icon: KeyRound,
        title: "Password View & Change for Developers",
        description: "The Feedback Forms section on the project page now shows the current plaintext password and includes an Edit button to change it. Changing the password immediately invalidates all active tester sessions.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 7, 2026",
    version: "0.18.0",
    title: "New — Feedback Forms",
    description: "Collect structured feedback from testers and clients via password-protected forms. Each submission flows through an AI clarification exchange before automatically creating a task in your project.",
    features: [
      {
        icon: ClipboardList,
        title: "AI-Powered Form Builder",
        description: "Create structured feedback forms by describing what you need in plain language. The AI proposes fields based on your description — review and confirm, then set a password for testers to access the form.",
        tag: "new",
      },
      {
        icon: Shield,
        title: "Password-Protected Tester Forms",
        description: "Each form lives at a shareable URL protected by a developer-set password. Testers access the form without needing an Ascend account. Sessions are signed and scoped per form; changing the password instantly invalidates all active sessions.",
        tag: "new",
      },
      {
        icon: Sparkles,
        title: "AI Follow-Up Chat",
        description: "After a tester submits their form, an AI (Claude Haiku) reviews the submission and asks targeted follow-up questions to fill in missing details — up to 3 questions. On completion, the linked task title and description are updated with the enriched content.",
        tag: "new",
      },
      {
        icon: ClipboardList,
        title: "Live Issue Tracker for Testers",
        description: "Testers can view a kanban or list tracker showing all their submitted issues and current statuses. The tracker polls every 30 seconds — as developers move tasks through Ascend, testers see updates in near real-time.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 3, 2026",
    version: "0.17.0",
    title: "New — Create Tasks with AI (Beta)",
    description: "Describe what you want to work on in plain language — the AI asks clarifying questions when needed, then proposes editable task cards for your approval before creating anything.",
    features: [
      {
        icon: Sparkles,
        title: "Conversational Task Creation",
        description: "Click 'Create with AI' in the sidebar to open a chat interface. Describe a task or goal in your own words. For simple, clear tasks the AI proposes them immediately. For complex or ambiguous input it asks up to a few focused questions before surfacing editable task cards you approve.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 3, 2026",
    version: "0.16.7",
    title: "Bug Fix — Assignee Avatar Updates Immediately After Change",
    description: "Changing a task's assignee and navigating back to the task list now reflects the change instantly without needing a manual page refresh.",
    features: [
      {
        icon: RefreshCw,
        title: "Assignee Change — Instant List Update",
        description: "After changing a task's assignee on the task detail page and going back, the global task list and note task list now immediately show the correct avatar (or no avatar if unassigned). Previously the old avatar remained until a full page refresh.",
        tag: "fix",
      },
    ],
  },
  {
    date: "March 3, 2026",
    version: "0.16.6",
    title: "Improved — Consistent Task List Design Across the App",
    description: "Tasks linked to notes now display identically to tasks everywhere else in the app — same priority circle, due date, description, and assignee avatar.",
    features: [
      {
        icon: List,
        title: "Note Tasks — Unified Design",
        description: "Tasks in the notes section now show the same priority-colored circle, due date, description preview, and assignee avatar as the global task list and project views.",
        tag: "improved",
      },
    ],
  },
  {
    date: "March 3, 2026",
    version: "0.16.5",
    title: "Bug Fix — Mobile Today Page Task Creation",
    description: "Fixed the + button on the Today page not opening the task creation drawer on mobile, and improved the smoothness of field interactions inside the drawer.",
    features: [
      {
        icon: CalendarDays,
        title: "Today Page — Create Tasks on Mobile",
        description: "The floating + button on the Today page now correctly opens the quick-add task drawer. Previously tapping it had no effect.",
        tag: "fix",
      },
      {
        icon: Smartphone,
        title: "Quick Add Drawer — Smoother Field Interactions",
        description: "Tapping the Date, Priority, Assignee, and Project chips inside the task creation drawer no longer causes the drawer to jump or reset. Fixed by preventing popover focus traps from conflicting with the drawer.",
        tag: "fix",
      },
    ],
  },
  {
    date: "March 3, 2026",
    version: "0.16.4",
    title: "Bug Fix — Estimate My Day",
    description: "Fixed the Estimate My Day feature failing with a validation error when tasks had long descriptions.",
    features: [
      {
        icon: Brain,
        title: "Estimate My Day — Long Description Fix",
        description: "Estimate My Day now works correctly even when tasks have long descriptions (e.g. from AI extraction). Descriptions are trimmed before being sent to the AI so they no longer exceed the API's validation limit.",
        tag: "fix",
      },
    ],
  },
  {
    date: "March 3, 2026",
    version: "0.16.3",
    title: "Bug Fix — Mobile Date Picker (New Task)",
    description: "Fixed the date picker in the new task drawer not saving the due date on mobile when no date had been previously selected.",
    features: [
      {
        icon: Smartphone,
        title: "Mobile Date Picker — New Task",
        description: "Tapping the Date chip when creating a new task now seeds today's date so clicking Done correctly saves it. Dismissing the picker without confirming no longer commits an accidental date.",
        tag: "fix",
      },
      {
        icon: Calendar,
        title: "Mobile Date Picker — Task Detail",
        description: "Fixed an edge case where a background data refresh while the mobile date picker was open could silently reset the selected date before Save was tapped.",
        tag: "fix",
      },
    ],
  },
  {
    date: "March 2, 2026",
    version: "0.16.2",
    title: "No Project Filter",
    description: "Filter the global task list to show only personal or one-off tasks not assigned to any project.",
    features: [
      {
        icon: FolderX,
        title: "No Project Filter",
        description: "The Project filter on the tasks page now includes a \"No Project\" option, letting you quickly view all tasks that aren't tied to any project.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 2, 2026",
    version: "0.16.1",
    title: "Bug Fixes — Date Picker & Priority Sync",
    description: "Fixed two bugs: the date/time picker now saves correctly when no prior due date was set, and priority changes on a task now immediately reflect in linked note task lists.",
    features: [
      {
        icon: Calendar,
        title: "Date Picker Save Fixed",
        description: "Opening the date picker on a task with no due date now seeds today's date and current time as the default, so clicking Save without changing anything correctly sets the due date.",
        tag: "fix",
      },
      {
        icon: RefreshCw,
        title: "Priority Sync in Note Task Lists",
        description: "Changing a task's priority and navigating back to a note's linked task list now immediately shows the updated priority, regardless of how quickly you navigate back.",
        tag: "fix",
      },
    ],
  },
  {
    date: "March 2, 2026",
    version: "0.16.0",
    title: "Today Page — Daily Focus View",
    description: "A dedicated Today page shows all tasks due today and overdue, grouped by project, with AI-powered time estimates and a day completion likelihood score.",
    features: [
      {
        icon: CalendarDays,
        title: "Today Page",
        description: "New /today page in the sidebar and mobile nav shows only what needs your attention today — tasks due today plus any overdue tasks, grouped by project.",
        tag: "new",
      },
      {
        icon: Sparkles,
        title: "AI Day Estimation",
        description: "Click 'Estimate My Day' to get AI-powered time estimates for each task and an overall completion likelihood based on your remaining hours.",
        tag: "new",
      },
      {
        icon: RefreshCw,
        title: "Quick Reschedule",
        description: "Reschedule any task directly from the Today view — choose Tomorrow, This Weekend, Next Week, or pick a custom date without opening the task.",
        tag: "new",
      },
    ],
  },
  {
    date: "March 1, 2026",
    version: "0.15.2",
    title: "AI Task Extraction Now Includes Source Context",
    description:
      "Each AI-extracted task now includes the original excerpt from your note that prompted it, so you always know where a task came from.",
    features: [
      {
        icon: Sparkles,
        title: "Source Attribution in Extracted Tasks",
        description:
          "When AI extracts tasks from a note, each task's description now includes an \"Original Content:\" section with the verbatim phrase or sentence from your note that the task was derived from. This makes it easy to trace any task back to its origin. The text is fully editable in the review dialog before tasks are created.",
        tag: "improved",
      },
    ],
  },
  {
    date: "March 1, 2026",
    version: "0.15.1",
    title: "Improved Date & Time Picker",
    description:
      "The date picker now scrolls to the selected date on open, uses 12-hour time format, and requires an explicit Save to commit changes.",
    features: [
      {
        icon: Clock,
        title: "Improved Date & Time Picker",
        description:
          "Calendar automatically scrolls to the selected date (or today) when opened. Time now uses 12-hour format with a tappable AM/PM toggle. A Save button confirms your selection before committing — clicking outside or pressing Escape discards changes.",
        tag: "improved",
      },
    ],
  },
  {
    date: "March 1, 2026",
    version: "0.15.0",
    title: "Hide Completed Tasks by Default",
    description:
      "Completed tasks are now hidden by default across all task views, with a filter toggle to show or hide them on demand.",
    features: [
      {
        icon: Eye,
        title: "Hide Completed Tasks by Default",
        description:
          "Completed tasks are no longer shown by default on the Tasks and Project Tasks pages. Toggle the 'Completed' filter button to show or hide them. Your preference is saved per page.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 26, 2026",
    version: "0.14.0",
    title: "Sections for Task Organization",
    description:
      "Group tasks into named sections within your project list view for better visual organization and workflow clarity.",
    features: [
      {
        icon: Layers,
        title: "Task Sections",
        description:
          "Create named sections to group tasks in the project list view. Organize your work into logical groups like 'Setup', 'API', 'QA' and more.",
        tag: "new",
      },
      {
        icon: GripVertical,
        title: "Drag & Drop in List View",
        description:
          "Drag and drop tasks to reorder them within sections, move them between sections, and reorder sections themselves.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 11, 2026",
    version: "0.13.2",
    title: "Deletion & Data Consistency Fixes",
    description:
      "Smoother task and note deletion with instant cache updates, no more stale lists or flash-of-not-found after deleting items.",
    features: [
      {
        icon: Trash2,
        title: "Reliable Task Deletion",
        description:
          "Deleting a task now works cleanly: no more 409 errors, 406 console errors, or stale tasks lingering on the list. The task disappears immediately from both the global tasks page and the project tasks page.",
        tag: "fix",
      },
      {
        icon: RefreshCw,
        title: "Instant Note List Updates",
        description:
          "Editing or deleting a note and navigating back to the project page now reflects changes immediately — no stale data or need to refresh.",
        tag: "fix",
      },
      {
        icon: StickyNote,
        title: "Smooth Note Deletion",
        description:
          "Deleting a note no longer flashes a \"Note not found\" page. A loading spinner shows briefly while navigating back to the project.",
        tag: "fix",
      },
      {
        icon: History,
        title: "Activity Feed Freshness",
        description:
          "The project activity feed now always fetches the latest entries when you navigate to the project page, so note edits and other recent changes appear without a manual refresh.",
        tag: "fix",
      },
    ],
  },
  {
    date: "February 11, 2026",
    version: "0.13.1",
    title: "Activity Feed Improvements",
    description:
      "Richer activity messages with before/after values, clickable entries, note tracking, and member name resolution.",
    features: [
      {
        icon: StickyNote,
        title: "Note Activity Tracking",
        description:
          "Creating, updating, and deleting notes now logs activity in the project feed. Note entries are clickable to navigate directly to the note.",
        tag: "new",
      },
      {
        icon: MousePointerClick,
        title: "Clickable Activity Entries",
        description:
          "Task and note activity entries are now clickable — click to navigate directly to the task or note. Deleted items show a non-clickable record with the title preserved.",
        tag: "new",
      },
      {
        icon: History,
        title: "Richer Activity Messages",
        description:
          "Project property changes now show before/after values (e.g., \"changed status from Active to Completed\"). Member add/remove shows the member's name. Lead changes show both old and new lead names.",
        tag: "improved",
      },
    ],
  },
  {
    date: "February 10, 2026",
    version: "0.13.0",
    title: "Project Activity Feed",
    description:
      "A chronological audit trail of all project changes — task updates, comments, member changes, and more — powered by database triggers and real-time subscriptions.",
    features: [
      {
        icon: History,
        title: "Project Activity Feed",
        description:
          "Every project now has a collapsible Activity section that logs task creation, status changes, priority changes, assignments, deletions, comments, member changes, and project updates. Entries show who did what, when, with full context preserved even after items are deleted.",
        tag: "new",
      },
      {
        icon: Zap,
        title: "Real-Time Activity Updates",
        description:
          "Activity entries appear instantly via Supabase Realtime. Open a project in two tabs — changes made in one appear in the other without refreshing. Powered by database triggers so logging is automatic and server-side.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 10, 2026",
    version: "0.12.0",
    title: "Due Date Time Picker & Task Detail Consolidation",
    description:
      "Due dates now support time-of-day selection, project due reminders notify the project lead, and the task detail experience has been consolidated into a single page for consistency.",
    features: [
      {
        icon: Clock,
        title: "Time Picker on Due Dates",
        description:
          "When setting a due date on a task or project, you can now pick a specific time of day. The time picker appears as a footer inside the calendar popover. On mobile, the due date calendar is an inline collapsible section for quick access.",
        tag: "new",
      },
      {
        icon: Calendar,
        title: "Inline Mobile Due Date",
        description:
          "On mobile, the due date is now a first-class field on the task detail page — visible between the description and attachments. Tap to expand an inline calendar with time picker. No more digging through the properties sheet.",
        tag: "improved",
      },
      {
        icon: Bell,
        title: "Project Due Reminders",
        description:
          "Projects with a due date and a designated lead now receive automatic reminders 1 hour before the deadline, powered by Inngest. Reminders are cancelled if the project is completed, archived, or the due date changes.",
        tag: "new",
      },
      {
        icon: Combine,
        title: "Unified Task Detail Page",
        description:
          "Consolidated 3 separate task detail components (dialog, mobile drawer, responsive wrapper) into a single /tasks/[id] page. This ensures all task editing features are available everywhere and eliminates feature drift between surfaces.",
        tag: "improved",
      },
    ],
  },
  {
    date: "February 9, 2026",
    version: "0.11.0",
    title: "Task Due Reminders via Inngest",
    description:
      "Scheduled task due date reminders powered by Inngest's durable workflow engine. Get notified 1 hour before a task is due — even if you haven't opened the app.",
    features: [
      {
        icon: Clock,
        title: "Due Date Reminders",
        description:
          "When a task has a due date and an assignee, a background function sleeps until 1 hour before the deadline and then creates an in-app notification. If the task is completed, deleted, or the due date changes, the reminder is automatically cancelled.",
        tag: "new",
      },
      {
        icon: Zap,
        title: "Inngest Durable Workflows",
        description:
          "Background notifications are powered by Inngest, a durable workflow engine that schedules, retries, and cancels long-running functions. This lays the foundation for future email and mobile push notifications.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 9, 2026",
    version: "0.10.0",
    title: "Notifications & @Mentions",
    description:
      "Real-time notification system with @mentions in comments, task assignment alerts, project invite notifications, and more.",
    features: [
      {
        icon: Bell,
        title: "Notification Center",
        description:
          "A new bell icon in the header shows your unread notifications in real time. Click to view a dropdown of all notifications, mark individual items or all as read, and click through to the relevant task or project.",
        tag: "new",
      },
      {
        icon: Users,
        title: "@Mentions in Comments",
        description:
          "Type @ in a comment on a shared project task to mention a teammate. A dropdown shows project members filtered as you type. The mentioned user receives a real-time notification instantly.",
        tag: "new",
      },
      {
        icon: CheckCircle2,
        title: "Task Assignment Notifications",
        description:
          "When you assign or unassign someone from a task, they receive an automatic notification. Works across all task editing surfaces (detail page, dialog, and mobile).",
        tag: "new",
      },
      {
        icon: Users,
        title: "Project & Lead Notifications",
        description:
          "Users are now notified when invited to a project, designated as project lead, or removed as project lead.",
        tag: "new",
      },
    ],
  },
  {
    date: "February 9, 2026",
    version: "0.9.1",
    title: "Rich Text Editing & Fixes",
    description:
      "WYSIWYG rich-text editor for task descriptions, plus editing bug fixes and cleaner list previews.",
    features: [
      {
        icon: FileText,
        title: "WYSIWYG Description Editor",
        description:
          "Task descriptions now use a rich-text editor powered by Tiptap. Bullets, numbered lists, bold, and italic render in real time while you type — no more raw markdown syntax.",
        tag: "new",
      },
      {
        icon: List,
        title: "Clean Task List Previews",
        description:
          "Task list and card previews now strip formatting instead of showing raw markdown or HTML characters.",
        tag: "improved",
      },
      {
        icon: CheckCircle2,
        title: "Task Edit Bug Fix",
        description:
          "Fixed an issue where typing in the title or description fields on the task detail page would immediately revert changes.",
        tag: "fix",
      },
      {
        icon: Smartphone,
        title: "Mobile Task Properties",
        description:
          "The task detail page now hides the properties sidebar on mobile and shows it via a floating toggle button and bottom sheet, matching the project page experience.",
        tag: "improved",
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
