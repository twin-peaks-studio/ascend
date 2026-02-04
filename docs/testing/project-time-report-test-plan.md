# Project Time Report - Test Automation & Regression Plan

## Overview

This document outlines the recommended test automation strategy and regression testing approach for the Project Time Report feature.

---

## 1. Unit Tests

### Hook: `useProjectTimeReport`

**File:** `src/hooks/__tests__/use-project-time-report.test.ts`

```typescript
describe('useProjectTimeReport', () => {
  describe('data fetching', () => {
    it('should return empty report when project has no tasks');
    it('should return empty report when tasks have no time entries');
    it('should fetch tasks including archived ones');
    it('should only include completed time entries (duration not null)');
    it('should handle Supabase errors gracefully');
  });

  describe('tasksByTime aggregation', () => {
    it('should sum durations for tasks with multiple entries');
    it('should sort tasks by total time descending');
    it('should include task metadata (status, isArchived)');
    it('should handle tasks with zero total time');
  });

  describe('byDay aggregation', () => {
    it('should group entries by local date');
    it('should sort days in reverse chronological order');
    it('should sort tasks within each day by time descending');
    it('should calculate correct total per day');
    it('should handle entries spanning multiple days');
    it('should handle timezone edge cases');
  });

  describe('total calculation', () => {
    it('should calculate correct total seconds');
    it('should format total time correctly');
  });

  describe('caching', () => {
    it('should use correct query key with projectId');
    it('should respect stale time of 60 seconds');
    it('should be disabled when user is not authenticated');
    it('should be disabled when projectId is empty');
  });
});
```

### Utility: `toLocalDateString`

```typescript
describe('toLocalDateString', () => {
  it('should convert ISO string to YYYY-MM-DD format');
  it('should use local timezone');
  it('should handle midnight edge cases');
  it('should handle DST transitions');
});
```

### Component: `TimeReportDayGroup`

**File:** `src/components/time/project-time-report/__tests__/time-report-day-group.test.tsx`

```typescript
describe('TimeReportDayGroup', () => {
  it('should render date header correctly');
  it('should show "Today" for current date');
  it('should show "Yesterday" for previous date');
  it('should format other dates as "EEE, MMM d"');
  it('should display total time in header');
  it('should be collapsed by default');
  it('should expand when defaultExpanded is true');
  it('should toggle expansion on header click');
  it('should render task list when expanded');
  it('should call onTaskClick with taskId when task clicked');
});
```

### Component: `TimeReportByTask`

**File:** `src/components/time/project-time-report/__tests__/time-report-by-task.test.tsx`

```typescript
describe('TimeReportByTask', () => {
  it('should render empty state when no tasks');
  it('should render numbered list of tasks');
  it('should display task title and time');
  it('should show status badge with correct styling');
  it('should show archived badge for archived tasks');
  it('should apply strikethrough to archived task titles');
  it('should call onTaskClick when task clicked');
  it('should be scrollable with max height');
});
```

### Component: `TimeReportByDay`

**File:** `src/components/time/project-time-report/__tests__/time-report-by-day.test.tsx`

```typescript
describe('TimeReportByDay', () => {
  it('should render empty state when no days');
  it('should render day groups for each day');
  it('should auto-expand first 2 days');
  it('should pass onTaskClick to day groups');
});
```

### Component: `TimeReportDialog`

**File:** `src/components/time/project-time-report/__tests__/time-report-dialog.test.tsx`

```typescript
describe('TimeReportDialog', () => {
  it('should render loading state');
  it('should render error state');
  it('should render total time');
  it('should have By Day tab selected by default');
  it('should switch between tabs');
  it('should pass onTaskClick to child components');
  it('should have accessible dialog description');
});
```

---

## 2. Integration Tests

### Database Integration

**File:** `src/hooks/__tests__/use-project-time-report.integration.test.ts`

```typescript
describe('useProjectTimeReport integration', () => {
  beforeEach(() => {
    // Seed test data in Supabase
  });

  it('should fetch and aggregate real data correctly');
  it('should handle large datasets efficiently');
  it('should respect RLS policies');
});
```

### React Query Integration

```typescript
describe('React Query integration', () => {
  it('should deduplicate concurrent requests');
  it('should refetch after stale time expires');
  it('should invalidate on relevant mutations');
});
```

---

## 3. End-to-End Tests (Playwright/Cypress)

### Feature: Time Report Access

**File:** `e2e/project-time-report.spec.ts`

```typescript
describe('Project Time Report', () => {
  beforeEach(() => {
    // Login and navigate to project with time data
  });

  describe('accessing the report', () => {
    it('should show Time row in properties panel', async () => {
      // Verify Time row exists with clock icon
      // Verify total time is displayed
      // Verify chevron indicates clickability
    });

    it('should open Time Report dialog on click', async () => {
      // Click Time row
      // Verify dialog opens
      // Verify title shows "Time Report"
      // Verify total time matches
    });

    it('should work on mobile via bottom sheet', async () => {
      // Set mobile viewport
      // Open properties sheet
      // Verify Time row visible
      // Click to open report
    });
  });

  describe('By Day view', () => {
    it('should display days in reverse chronological order', async () => {
      // Open report
      // Verify first day is most recent
      // Verify dates are formatted correctly
    });

    it('should expand/collapse day groups', async () => {
      // Verify first 2 days expanded
      // Click to collapse
      // Verify tasks hidden
      // Click to expand
      // Verify tasks visible
    });

    it('should show tasks sorted by time within each day', async () => {
      // Expand a day
      // Verify task order matches time descending
    });
  });

  describe('By Task view', () => {
    it('should switch to By Task tab', async () => {
      // Open report
      // Click By Task tab
      // Verify view changes
    });

    it('should display tasks sorted by total time', async () => {
      // Verify task order
      // Verify numbered ranking
    });

    it('should show status badges correctly', async () => {
      // Verify Done badge styling
      // Verify In Progress badge styling
      // Verify To Do badge styling
    });

    it('should indicate archived tasks', async () => {
      // Verify archived badge
      // Verify strikethrough text
    });
  });

  describe('task interaction', () => {
    it('should open task details when task clicked in By Day view', async () => {
      // Open report
      // Expand day
      // Click task
      // Verify task details dialog opens
      // Verify Time Report remains open behind
    });

    it('should open task details when task clicked in By Task view', async () => {
      // Switch to By Task
      // Click task
      // Verify task details dialog opens
    });

    it('should keep Time Report open after closing task details', async () => {
      // Open report
      // Click task
      // Close task details
      // Verify Time Report still visible
      // Verify same tab/state preserved
    });
  });

  describe('empty states', () => {
    it('should show empty state for project with no time entries', async () => {
      // Navigate to project without time data
      // Open report
      // Verify "No time tracked yet" message
    });
  });

  describe('loading states', () => {
    it('should show loading spinner while fetching', async () => {
      // Intercept API call with delay
      // Open report
      // Verify spinner visible
      // Wait for load
      // Verify content appears
    });
  });
});
```

---

## 4. Visual Regression Tests

### Recommended Screenshots

Using tools like Percy, Chromatic, or Playwright visual comparisons:

1. **Time row in Properties panel** - Light and dark mode
2. **Time Report dialog - By Day view** - Expanded and collapsed states
3. **Time Report dialog - By Task view** - With various status badges
4. **Empty state** - No time tracked
5. **Loading state** - Spinner visible
6. **Mobile view** - Bottom sheet with Time row

---

## 5. Performance Tests

### Metrics to Track

1. **Time to Interactive (TTI)** when opening dialog
2. **Query duration** for tasks and time_entries fetch
3. **Memory usage** with large datasets (100+ time entries)
4. **Re-render count** when switching tabs

### Test Scenarios

```typescript
describe('Performance', () => {
  it('should load report under 500ms for typical project', async () => {
    // Measure time from click to content visible
  });

  it('should handle 500+ time entries without lag', async () => {
    // Seed large dataset
    // Open report
    // Verify smooth scrolling
    // Verify tab switching is instant
  });

  it('should not cause excessive re-renders', async () => {
    // Use React DevTools Profiler
    // Count renders on tab switch
    // Count renders on expand/collapse
  });
});
```

---

## 6. Regression Test Checklist

### Before Each Release

- [ ] Time row displays in Properties panel
- [ ] Total time calculation is accurate
- [ ] Dialog opens and closes correctly
- [ ] By Day view shows correct date groupings
- [ ] By Task view shows correct sorting
- [ ] Task click opens details dialog
- [ ] Time Report persists after closing task details
- [ ] Mobile bottom sheet works
- [ ] Empty state displays correctly
- [ ] Loading state displays correctly
- [ ] No console errors
- [ ] No duplicate network requests

### Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Accessibility Testing

- [ ] Screen reader announces dialog correctly
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus management on dialog open/close
- [ ] Color contrast meets WCAG AA

---

## 7. Test Data Requirements

### Seed Data Scenarios

1. **Project with varied time data:**
   - Multiple days with entries
   - Multiple tasks per day
   - Tasks with different statuses
   - Archived tasks with time entries
   - Tasks with multiple time entries

2. **Edge cases:**
   - Task with 0 total time (only running timer)
   - Day with single entry
   - Very long task titles (truncation)
   - Time entries spanning midnight

3. **Empty scenarios:**
   - Project with no tasks
   - Project with tasks but no time entries

---

## 8. CI/CD Integration

### Recommended Pipeline

```yaml
test:
  stages:
    - unit:
        run: npm run test:unit -- --coverage
        coverage_threshold: 80%

    - integration:
        run: npm run test:integration
        requires: [unit]

    - e2e:
        run: npm run test:e2e
        requires: [integration]
        parallel: true
        browsers: [chrome, firefox, safari]

    - visual:
        run: npm run test:visual
        requires: [e2e]
        on: [pull_request]
```

### Pre-commit Hooks

```json
{
  "husky": {
    "pre-commit": "npm run test:unit -- --related"
  }
}
```

---

## 9. Monitoring & Alerting

### Production Metrics

1. **Error tracking:** Monitor for Supabase query failures
2. **Performance:** Track P95 dialog load time
3. **Usage:** Track feature adoption (dialog opens per user)

### Alerts

- Alert if error rate > 1% on time report queries
- Alert if P95 load time > 2 seconds
