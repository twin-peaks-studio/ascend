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
