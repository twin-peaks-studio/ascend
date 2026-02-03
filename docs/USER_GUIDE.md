# Ascend User Guide

A comprehensive guide to using Ascend, a modern project and task management application.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Navigation](#navigation)
4. [Dashboard](#dashboard)
5. [Projects](#projects)
6. [Notes](#notes)
7. [Tasks & Kanban Board](#tasks--kanban-board)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Dark Mode](#dark-mode)
10. [Mobile Usage](#mobile-usage)
11. [Tips & Best Practices](#tips--best-practices)

---

## Overview

Ascend is a Linear-inspired task management application designed for focused, efficient workflow management. The app follows a **project-centric model** where:

- **Projects** are the primary organizational unit (similar to Linear)
- Each project can contain **multiple tasks** that move through workflow stages
- Projects can have **documents, links, and notes** attached
- Tasks flow through a **Kanban board** (To Do → In Progress → Done)

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Project** | A container for multiple tasks with its own description, color, status, and attached documents |
| **Task** | A work item that belongs to a project and moves through Kanban columns |
| **Note** | Meeting notes or documentation linked to a project, with the ability to create tasks directly from notes |
| **Document** | A link, document reference, or resource attached to a project |
| **Kanban Board** | Visual board showing all tasks organized by their current status |

---

## Getting Started

### First Launch

When you first open Ascend, you'll see an empty dashboard. Here's how to get started:

1. **Create your first project** using `Cmd/Ctrl + P` or the "New Project" button
2. **Add a task** to your project from the project detail page
3. **View all tasks** on the Kanban board at `/tasks`
4. **Drag tasks** between columns as work progresses

### URL Structure

| URL | Page | Purpose |
|-----|------|---------|
| `/` | Dashboard | Overview of all projects and tasks |
| `/tasks` | Kanban Board | Visual task management with drag-and-drop |
| `/projects` | Projects List | Browse and manage all projects |
| `/projects/[id]` | Project Detail | View/edit a specific project and its tasks |
| `/projects/[id]/notes/create` | Create Note | Create a new note for a project |
| `/projects/[id]/notes/[noteId]` | Note Detail | View/edit a note and manage linked tasks |

---

## Navigation

### Desktop Sidebar

The left sidebar (visible on large screens) provides quick access to all main sections:

- **Dashboard** - Home page with overview stats
- **Tasks** - Kanban board view
- **Projects** - All projects list
- **Your projects** - Quick links to recent projects
- **Shortcuts** - View keyboard shortcuts (click or press `?`)
- **Settings** - Application settings

**Collapsible Sidebar:**
- Click the **Collapse** button at the bottom of the sidebar to minimize it
- When collapsed, only icons are shown for a compact view
- Click the expand button to restore the full sidebar

### Mobile & Tablet Navigation

On mobile and tablet devices:
- A **floating bottom navigation bar** provides quick access to main sections
- The pill-shaped bar contains: Dashboard, Tasks, and Projects
- A **Search** button is available as a separate circle
- A **floating + button** in the bottom-right creates new tasks

---

## Dashboard

The dashboard (`/`) provides a bird's-eye view of your work:

### Stats Section

Four cards showing:
- **Total Projects** - Count of all projects
- **Active Tasks** - Tasks in To Do or In Progress
- **Completed** - Tasks marked as Done
- **In Progress** - Tasks currently being worked on

### Recent Projects

- Shows your most recently updated projects
- Click any project to view its details
- "View all projects" link to see the full list

### Quick Actions

- **New Project** button in the header
- Keyboard shortcut `Cmd/Ctrl + P` from anywhere

---

## Projects

### Projects List (`/projects`)

Displays all projects in a grid layout:

#### Project Card Information
- **Color indicator** - Visual identifier (left border)
- **Title** - Project name
- **Description** - Brief summary (truncated if long)
- **Status badge** - Active, Completed, or Archived
- **Task status** - Shows the linked task's current state
- **Timestamps** - Created and updated dates

#### Project Statuses

| Status | Meaning | Visual |
|--------|---------|--------|
| **Active** | Currently being worked on | Blue badge |
| **Completed** | Finished | Green badge |
| **Archived** | No longer active, kept for reference | Gray badge |

#### Actions
- **Click card** - Navigate to project detail
- **New Project** - Button in header or `Cmd/Ctrl + P`

### Creating a Project

1. Click "New Project" or press `Cmd/Ctrl + P`
2. Fill in the form:
   - **Title** (required) - Name of the project
   - **Description** (optional) - Detailed description
   - **Color** - Pick a color for visual identification
   - **Status** - Default is "Active"
3. Click "Create Project"

### Project Detail (`/projects/[id]`)

The detail page shows everything about a single project in a **Linear-style two-column layout**:

#### Navigation Bar
- **Back to Projects** link with breadcrumb navigation
- **Delete** button (trash icon) in top-right

#### Left Panel - Main Content

**Project Title (Inline Editable):**
- Click the title to enter edit mode
- Make changes, then click **Save** or **Cancel**
- Press `Enter` to save, `Escape` to cancel

**Description (Inline Editable with Rich Text):**
- Click the description area to enter edit mode
- Use the formatting toolbar for rich text:
  - **Bold** - Click B button or Cmd/Ctrl+B
  - **Italic** - Click I button or Cmd/Ctrl+I
  - **Bullet List** - Click list button or type `- ` at line start
  - **Numbered List** - Click numbered list button or type `1. ` at line start
  - **Indent/Outdent** - Use arrow buttons (Tab/Shift+Tab on desktop)
  - **Link** - Click link button or Cmd/Ctrl+K
- Press Enter in a list to continue with the next bullet/number
- Press Enter on an empty list item to exit list mode
- Edit the text, then click **Save** or **Cancel**
- Shows "Add a description..." placeholder if empty

**Tasks Section (Collapsible):**
- Click the section header to expand/collapse (collapsed by default when tasks exist)
- Shows task count in the header (e.g., "Tasks (3)")
- Each task card is clickable to open the full task details dialog
- Task cards display title, description preview, status badge, and priority badge
- "Add Task" button always visible to create new tasks
- Click any task to view/edit its full details in the same dialog used on the Tasks page

**Resources Section (Collapsible):**
- Click the section header to expand/collapse
- Shows document count in header
- Manage links, documents, and notes
- "Add document or link..." button to add new resources

#### Right Panel - Properties Sidebar

The properties sidebar is **collapsible** on desktop and tablet:
- Click the **close icon** (panel icon) to hide the sidebar
- When collapsed, a small toggle button appears to restore it
- On mobile, properties are accessed via a **floating settings button** (bottom-left)

**Properties Available:**
- **Status** - Click to change (Active, Completed, Archived)
- **Lead** - Assign a project lead from team members
- **Due Date** - Set a deadline with the calendar picker
- **Priority** - Set urgency level (Low, Medium, High, Urgent)
- **Color** - Click any color swatch to change the project color
- **Team** - View and manage team members

All property changes save immediately when selected.

**Notes Section (Collapsible):**
- Click the section header to expand/collapse
- Shows note count in the header (e.g., "Notes (3)")
- Each note card displays title and last updated date
- Click any note to open the note detail page
- "Add Note" button to create new notes

---

## Notes

Notes allow you to capture meeting notes, discussions, and documentation within a project. You can create tasks directly from notes, which automatically links them to both the note and the project.

### Creating a Note

1. Go to a project detail page (`/projects/[id]`)
2. Expand the **Notes** section
3. Click **"Add Note"** button
4. Fill in the form:
   - **Title** (required) - Name of the note
   - **Content** (optional) - Rich text content with formatting support
5. Click **"Create Note"** to save

### Note Detail Page (`/projects/[id]/notes/[noteId]`)

The note detail page provides a focused environment for editing notes and managing related tasks.

#### Header
- **Back button** - Returns to the project page
- **Breadcrumb** - Shows project name / Notes
- **Delete button** - Removes the note (tasks remain, just unlinked)

#### Inline Editable Title
- Click the title to enter edit mode
- Press `Enter` to save, `Escape` to cancel
- Changes save immediately

#### Rich Text Content Editor
- Full markdown support with formatting toolbar:
  - **Bold** - Click B button or Cmd/Ctrl+B
  - **Italic** - Click I button or Cmd/Ctrl+I
  - **Bullet List** - Click list button
  - **Numbered List** - Click numbered list button
  - **Indent/Outdent** - Use arrow buttons
  - **Link** - Click link button or Cmd/Ctrl+K
- **Auto-save** - Changes save automatically after 1.5 seconds of inactivity
- Shows "Changes are saved automatically" indicator

#### Tasks from This Note Section (Collapsible)

This section shows all tasks that were created from or linked to this note.

**Task List:**
- Each task displays:
  - **Status toggle** - Click the circle to mark complete/incomplete
  - **Title** - Click to open full task details dialog
  - **Description preview** - If available
  - **Priority badge** - Color-coded priority level
  - **Unlink button** - Removes the task from this note (task still exists)

**Quick Add Task:**
- Click "Add a task from this note..." to expand the input
- Enter a task title and press Enter or click Send
- New task is automatically:
  - Created with "To Do" status and "Medium" priority
  - Linked to the current note
  - Added to the project's task list

**Task Details Dialog:**
- Clicking a task title opens the same task details dialog used on the project and tasks pages
- Edit title, description, status, priority, assignee, due date
- Changes reflect immediately in the note's task list

### Notes and Tasks Relationship

| Feature | Behavior |
|---------|----------|
| **Task Visibility** | Tasks linked to a note appear in both the note's task list AND the project's task list |
| **Creating from Note** | Creates task with note's project, links to both |
| **Unlinking Task** | Removes from note's list only; task remains in project |
| **Deleting Note** | Tasks remain but are unlinked from the note |
| **Archiving Task** | Task no longer appears in note's task list |

### Tips for Using Notes

1. **Meeting Notes** - Create a note for each meeting, then add action items as tasks
2. **Discussion Summaries** - Capture key decisions and create follow-up tasks
3. **Research Documentation** - Document findings and create tasks for next steps
4. **Use Rich Formatting** - Bullet lists and numbered lists help organize content
5. **Link Related Tasks** - Tasks created from notes maintain a clear audit trail

---

## Tasks & Kanban Board

### Kanban Board (`/tasks`)

The primary task management interface with three columns:

| Column | Status | Purpose |
|--------|--------|---------|
| **To Do** | `todo` | Tasks not yet started |
| **In Progress** | `in-progress` | Tasks currently being worked on |
| **Done** | `done` | Completed tasks |

### Task Cards

Each card displays:
- **Project color** - Left border indicator
- **Title** - Task name
- **Project name** - Which project it belongs to
- **Priority badge** - Color-coded urgency level
- **Special badges** - Duplicate or Archived indicators

#### Priority Levels

| Priority | Color | Use Case |
|----------|-------|----------|
| **Low** | Gray | Nice-to-have, no rush |
| **Medium** | Blue | Normal priority (default) |
| **High** | Orange | Important, needs attention soon |
| **Urgent** | Red | Critical, needs immediate attention |

### Drag and Drop

**Moving tasks between columns:**
1. Click and hold a task card
2. Drag to the desired column
3. Release to drop

**What happens:**
- Task status updates automatically
- Position is saved
- Changes sync to database immediately

**Visual feedback:**
- Dragged card shows elevation shadow
- Drop zones highlight when hovering
- Smooth animations on drop

### Task Actions Menu

Click the **three dots** (⋮) on any task card:

| Action | Description |
|--------|-------------|
| **Edit** | Open edit dialog to modify task |
| **View Project** | Navigate to the parent project |
| **Mark as Duplicate** | Flag task as duplicate (toggleable) |
| **Archive** | Soft-delete task (can be unarchived) |
| **Delete** | Permanently remove task |

### Creating a Task

From the Kanban board:
1. Press `Cmd/Ctrl + K` or click "New Task"
2. Select which project to add the task to
3. Fill in:
   - **Title** (required)
   - **Description** (optional) - supports rich text formatting (see below)
   - **Priority** (default: Medium)
   - **Status** (default: To Do)
4. Click "Create Task"

### Rich Text Formatting in Descriptions

Descriptions support markdown-style formatting with a visual toolbar:

**Toolbar Buttons:**
| Button | Action | Keyboard Shortcut |
|--------|--------|-------------------|
| **B** | Bold text | Cmd/Ctrl + B |
| **I** | Italic text | Cmd/Ctrl + I |
| List | Bullet list | Type `- ` at line start |
| 1. List | Numbered list | Type `1. ` at line start |
| ← | Decrease indent | Shift + Tab |
| → | Increase indent | Tab |
| Link | Insert link | Cmd/Ctrl + K |

**Word-like List Behavior:**
- Type `- ` or `* ` at the start of a line to begin a bullet list
- Type `1. ` at the start of a line to begin a numbered list
- Press **Enter** to automatically continue the list with the next item
- Press **Enter** on an empty list item to exit list mode
- Use **Tab** (or indent button) to create nested lists
- Use **Shift+Tab** (or outdent button) to decrease nesting

**Examples:**
```
**bold text** → bold text
*italic text* → italic text
- Item 1
- Item 2
  - Nested item
1. First
2. Second
[Link text](https://example.com) → clickable link
```

**Note:** A project can have multiple tasks. When creating a task, you can select which project it belongs to, or leave it unassigned.

### Editing a Task

**Quick Edit (from Kanban):**
1. Click the three dots menu on a task
2. Select "Edit"
3. Modify any fields
4. Click "Save Changes"

**Full Task Details View:**
1. Click directly on a task card to open the full details dialog
2. The dialog shows a two-column layout (80% screen size):
   - **Left panel**: Title (with completion checkbox), description, and attachments
   - **Right sidebar**: Project, assignee, date, priority, and status

**Editing Title or Description:**
1. Click on the title or description to enter edit mode
2. Make your changes
3. Click **Save** to confirm or **Cancel** to discard changes
4. You can also press `Enter` to save (title only) or `Escape` to cancel

**Editing Sidebar Fields (Project, Assignee, Date, Priority, Status):**
- Changes save immediately when you select a new value
- No need to click Save - the update happens automatically
- UI updates smoothly without any page refresh

Or from the project detail page, expand the Tasks section and click on any task card to open its details.

---

## Keyboard Shortcuts

Ascend supports keyboard shortcuts for power users:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick create task |
| `Cmd/Ctrl + P` | Quick create project |
| `Cmd/Ctrl + /` | Show shortcuts help dialog |
| `?` | Show shortcuts help dialog |
| `Escape` | Close any open dialog / Cancel editing |
| `Enter` | Save title when editing (in task details) |

### Description Editor Shortcuts

When editing a description field:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Bold selected text |
| `Cmd/Ctrl + I` | Italic selected text |
| `Cmd/Ctrl + K` | Insert link |
| `Tab` | Indent list item |
| `Shift + Tab` | Outdent list item |
| `Enter` | Continue list on new line |

### Shortcuts Dialog

Press `?` or `Cmd/Ctrl + /` to see all available shortcuts in a modal dialog.

---

## Dark Mode

Ascend supports both light and dark themes:

### Toggling Theme
- Click the **sun/moon icon** in the top-right header
- Theme preference is saved to your browser

### System Preference
- On first visit, Ascend detects your system preference
- If your OS is in dark mode, Ascend will start in dark mode

### Theme Persistence
- Your choice is stored in `localStorage`
- Returns to your preferred theme on next visit

---

## Mobile Usage

Ascend is fully responsive and works on all device sizes:

### Phone Layout
- **Navigation** - Floating bottom navigation bar with main sections
- **Kanban** - Single column view, swipe to see other columns
- **Cards** - Full-width, touch-optimized
- **Buttons** - Minimum 44px touch targets
- **Project Properties** - Access via floating settings button (bottom-left) when viewing a project
- **Quick Add** - Floating + button for creating new tasks

### Tablet Layout
- **Navigation** - Uses the same floating bottom navigation as mobile
- **Kanban** - Shows 2-3 columns depending on width
- **Forms** - Optimized modal sizes
- **Project Properties** - Properties sidebar visible and collapsible

### Desktop Layout
- **Sidebar** - Full sidebar with navigation and project links (collapsible)
- **Kanban** - Full three-column view
- **Project Properties** - Properties sidebar always visible (collapsible)

### Touch Interactions
- **Drag and drop** - Touch and hold to drag tasks
- **Menus** - Tap to open action menus
- **Swipe** - Navigate between Kanban columns on mobile
- **Properties Sheet** - Swipe down to dismiss the mobile properties panel

### Background Recovery
When you return to the app after it has been in the background (switching apps, locking screen, etc.):
- **Data refreshes automatically** - No manual refresh needed
- **Your session stays active** - No need to log in again
- **Changes sync immediately** - Any updates made offline will sync

---

## Tips & Best Practices

### Organizing Work

1. **Use projects for initiatives** - Each project represents a distinct piece of work
2. **Color code by type** - Use colors to categorize (e.g., blue for features, red for bugs)
3. **Keep descriptions clear** - Future you will thank present you
4. **Attach relevant links** - Keep documentation close to the work

### Efficient Workflow

1. **Learn shortcuts** - `Cmd+K` and `Cmd+P` save significant time
2. **Use the Kanban view** - Best for daily task management
3. **Regular cleanup** - Archive completed projects periodically
4. **Priority matters** - Reserve "Urgent" for truly urgent items

### Data Management

1. **Cross-device sync** - Your data syncs via Supabase automatically
2. **No manual saves** - All changes save immediately
3. **Automatic refresh** - Data refreshes automatically when you return to the app after backgrounding
4. **Refresh for latest** - If working on multiple devices, refresh to see updates

### Common Workflows

**Starting a new feature:**
1. Create a project with `Cmd+P`
2. Add description and relevant links
3. Create the task with `Cmd+K`
4. Start working - move to "In Progress"

**Daily standup review:**
1. Open Tasks page (`/tasks`)
2. Review "In Progress" column
3. Move completed work to "Done"
4. Pull new work from "To Do"

**Weekly cleanup:**
1. Go to Projects page
2. Archive completed projects
3. Review and update priorities
4. Add any new initiatives

---

## Troubleshooting

### Common Issues

**Tasks not saving:**
- Check your internet connection
- Refresh the page
- Check browser console for errors

**Drag and drop not working:**
- Ensure JavaScript is enabled
- Try a different browser
- Clear browser cache

**Dark mode not persisting:**
- Ensure cookies/localStorage isn't blocked
- Check browser privacy settings

**Data not updating after returning from background:**
- Wait a moment - data refreshes automatically when you return
- If data still seems stale, pull down to refresh (mobile) or click refresh
- Check your internet connection

### Getting Help

If you encounter issues:
1. Refresh the page
2. Check browser developer console for errors
3. Ensure Supabase connection is working
4. Contact your administrator

---

## Glossary

| Term | Definition |
|------|------------|
| **Kanban** | Visual board with columns representing workflow stages |
| **Sprint** | A time-boxed period of work (future feature) |
| **Archive** | Soft-delete that hides but doesn't remove data |
| **Duplicate** | A task flagged as a copy of another |
| **RLS** | Row Level Security - Supabase feature for data access control |

---

*Last updated: February 2026*
