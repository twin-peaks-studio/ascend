# Project Guidelines for Claude

## Consistency Rules

### Task Editing Experience
When implementing changes to the task details dialog or task editing functionality on either the **project page** (`/projects/[id]`) or the **tasks page** (`/tasks`), always ask the user if the change should also apply to the other page. The task editing experience must be consistent across both pages.

Examples of changes that should be synchronized:
- Adding new fields to the task details dialog
- Changing how task updates are handled (optimistic updates vs refetch)
- Modifying the task card appearance or click behavior
- Adding new actions (delete, archive, duplicate, etc.)

## Technical Patterns

### Optimistic Updates
Prefer optimistic updates over refetching for a smoother user experience. Update local state immediately after a successful API call instead of calling `refetch()`.

### State Management
- Use `setProject` or `setTasks` to update local state optimistically
- Only call `refetch()` when necessary (e.g., after creating new items that need server-generated data)

### Data Fetching (React Query)
This project uses React Query (`@tanstack/react-query`) for data fetching. Key patterns:
- All data hooks use React Query for automatic request deduplication and caching
- `refetchOnWindowFocus: true` handles mobile backgrounding recovery automatically
- Query keys are defined in each hook file (e.g., `projectKeys`, `taskKeys`, `noteKeys`)
- Use `queryClient.invalidateQueries()` after mutations to refresh related data

## Tech Debt & Feature Wrap-up Checklist

**IMPORTANT:** When cleaning up tech debt or completing a new feature/architecture change, always verify network efficiency:

### Network Request Audit
1. **Check for duplicate requests**: Open browser DevTools Network tab and navigate between pages. Each navigation should make a reasonable number of requests (typically 5-15, not 100+).
2. **Verify request deduplication**: Multiple components using the same hook should result in ONE network request, not one per component. React Query handles this automatically.
3. **Check for infinite loops**: Watch for rapidly repeating requests in the Network tab. This usually indicates a dependency array bug in `useCallback` or `useEffect`.

### Common Pitfalls to Avoid
1. **Never include derived state in useCallback dependencies**:
   ```typescript
   // BAD - creates infinite loop
   const fetchData = useCallback(() => { ... }, [data.length]);

   // GOOD - stable dependencies only
   const fetchData = useCallback(() => { ... }, [userId]);
   ```

2. **Never include object references in dependencies when the object changes on each render**:
   ```typescript
   // BAD - object reference changes every render
   const fetchItem = useCallback(() => { ... }, [item]);

   // GOOD - use primitive identifier
   const fetchItem = useCallback(() => { ... }, [itemId]);
   ```

3. **Prefer React Query over manual fetch/state management** - it handles caching, deduplication, and background refetching automatically.

### Scalability Check
Before completing a feature, verify data fetching scales properly:
- Does the query fetch only what's needed? (e.g., team members, not ALL users)
- Are there N+1 query patterns that will degrade with more data?
- Is caching configured appropriately (`staleTime`, `gcTime`)?

### Dev Server Health
If the dev server becomes unresponsive ("Compiling..." stuck, high CPU):
1. Check Network tab for rapid repeated requests (infinite loop symptom)
2. Review recent changes to `useCallback`/`useEffect` dependency arrays
3. Look for state that changes → triggers fetch → changes state loops
