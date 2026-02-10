# Project Time Report Feature

## Overview

The Project Time Report provides visibility into time spent on tasks within a project. It helps users understand time allocation, identify bottleneck tasks, and gather data for billing/time tracking reports.

## User Guide

### Accessing the Time Report

1. Navigate to any project page (`/projects/[id]`)
2. Look in the **Properties panel** (right sidebar on desktop, bottom sheet on mobile)
3. Find the **"Time"** row at the bottom showing the total tracked time
4. Click on it to open the Time Report modal

### Time Report Views

The Time Report offers two views, accessible via tabs:

#### By Day View
- Shows days in reverse chronological order (most recent first)
- Each day displays total time worked
- Click the day header to expand/collapse the task list
- First 2 days are auto-expanded by default
- Tasks within each day are sorted by time spent (most to least)

#### By Task View
- Shows all tasks with tracked time, sorted by total time (most to least)
- Displays task status badge (To Do, In Progress, Done)
- Shows "Archived" badge for archived tasks
- Numbered list indicates ranking by time spent

### Clicking on Tasks

- Click any task in either view to open the Task Details dialog
- The Time Report remains open behind the Task Details
- Close the Task Details to return to the Time Report

### What's Included

- All tasks with time entries are shown, including:
  - Active tasks
  - Completed tasks (status: Done)
  - Archived tasks
- Only completed time entries count (running timers are excluded)

---

## Technical Documentation

### Architecture

```
src/
├── hooks/
│   └── use-project-time-report.ts    # Data fetching and aggregation
├── components/
│   └── time/
│       └── project-time-report/
│           ├── index.ts                    # Exports
│           ├── time-report-dialog.tsx      # Main modal component
│           ├── time-report-by-day.tsx      # Day-grouped view
│           ├── time-report-by-task.tsx     # Task-sorted view
│           └── time-report-day-group.tsx   # Expandable day section
```

### Data Flow

```
┌─────────────────────┐
│  PropertiesPanel    │
│  (Time row click)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  TimeReportDialog   │
│  - useProjectTime   │
│    Report hook      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│  TimeReportByDay    │ OR  │  TimeReportByTask   │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          ▼                           │
┌─────────────────────┐               │
│ TimeReportDayGroup  │               │
└─────────────────────┘               │
          │                           │
          └───────────┬───────────────┘
                      │
                      ▼ (onTaskClick)
          ┌─────────────────────┐
          │ /tasks/[id] page    │
          │ (navigates to)      │
          └─────────────────────┘
```

### Hook: `useProjectTimeReport`

**Location:** `src/hooks/use-project-time-report.ts`

**Purpose:** Fetches and aggregates time tracking data for a project.

**Query Strategy:**
1. Fetch all tasks for the project (including archived)
2. Fetch all completed time entries for those tasks
3. Aggregate data by task and by day in JavaScript

**Returns:**
```typescript
interface ProjectTimeReport {
  totalSeconds: number;
  tasksByTime: TaskTimeData[];  // Sorted by time desc
  byDay: DayTimeData[];         // Sorted by date desc
}

interface TaskTimeData {
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  isArchived: boolean;
  totalSeconds: number;
}

interface DayTimeData {
  date: string;           // YYYY-MM-DD
  totalSeconds: number;
  tasks: DayTaskData[];   // Sorted by time desc
}
```

**Caching:**
- Query key: `["project-time-report", projectId]`
- Stale time: 60 seconds
- Enabled only when user is authenticated and projectId exists

### Database Queries

The hook makes 2 Supabase queries:

1. **Tasks Query:**
```sql
SELECT id, title, status, is_archived
FROM tasks
WHERE project_id = $projectId
```

2. **Time Entries Query:**
```sql
SELECT entity_id, start_time, duration
FROM time_entries
WHERE entity_type = 'task'
  AND entity_id IN ($taskIds)
  AND duration IS NOT NULL
ORDER BY start_time DESC
```

### Component Props

#### TimeReportDialog
```typescript
interface TimeReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  onTaskClick?: (taskId: string) => void;
}
```

#### TimeReportByDay
```typescript
interface TimeReportByDayProps {
  days: DayTimeData[];
  onTaskClick?: (taskId: string) => void;
}
```

#### TimeReportByTask
```typescript
interface TimeReportByTaskProps {
  tasks: TaskTimeData[];
  onTaskClick?: (taskId: string) => void;
}
```

#### TimeReportDayGroup
```typescript
interface TimeReportDayGroupProps {
  date: string;
  totalSeconds: number;
  tasks: DayTaskData[];
  defaultExpanded?: boolean;
  onTaskClick?: (taskId: string) => void;
}
```

### Integration Points

#### PropertiesPanel
Added two new props:
- `totalProjectTime?: string` - Formatted time string for display
- `onShowTimeReport?: () => void` - Callback to open the report

#### Project Page
- Uses `useProjectTotalTime` for sidebar display
- Uses `useProjectTimeReport` (via dialog) for full report
- `handleOpenTaskDetailsById` callback finds task by ID and opens details

### Accessibility

- `DialogDescription` with `sr-only` class for screen readers
- All interactive elements are buttons with proper focus states
- Keyboard navigation supported via Radix UI primitives

### Performance Considerations

1. **Lazy Loading:** Time report data only fetched when dialog opens
2. **React Query Caching:** 60-second stale time prevents excessive refetches
3. **Client-side Aggregation:** Reduces database load by doing grouping in JS
4. **Virtualization Ready:** Max height with overflow-y-auto on lists

### Future Enhancements

1. **Week/Month Grouping:** Add additional time period views
2. **Date Range Filter:** Allow filtering to specific date ranges
3. **Export Functionality:** CSV/PDF export for billing reports
4. **User Breakdown:** Show time by team member (multi-user projects)
