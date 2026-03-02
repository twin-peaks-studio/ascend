"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/section";
import { SectionInlineCreate } from "@/components/section";
import { TaskListItem } from "./task-list-view";
import { SortableTaskListItem } from "./sortable-task-list-item";
import {
  sortTasksWithCompletedLast,
  type TaskSortField,
  type TaskSortDirection,
} from "@/lib/task-sort";
import type { TaskWithProject, TaskStatus, Section, Profile } from "@/types";

const UNSECTIONED_ID = "__unsectioned__";

interface SectionedTaskListViewProps {
  tasks: TaskWithProject[];
  sections: Section[];
  collapsedSectionIds: Set<string>;
  onToggleSectionCollapse: (sectionId: string) => void;
  onTaskClick?: (task: TaskWithProject) => void;
  onStatusToggle?: (task: TaskWithProject) => void;
  onAddTask?: (status: TaskStatus, sectionId?: string | null) => void;
  onCreateSection?: (name: string) => void;
  onRenameSection?: (sectionId: string, name: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onTaskMove?: (
    taskId: string,
    sectionId: string | null,
    sectionPosition: number
  ) => Promise<boolean>;
  onSectionReorder?: (
    updates: Array<{ id: string; position: number }>
  ) => Promise<boolean>;
  sortField?: TaskSortField;
  sortDirection?: TaskSortDirection;
  profiles?: Profile[];
}

function DroppableContainer({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
}

export function SectionedTaskListView({
  tasks,
  sections,
  collapsedSectionIds,
  onToggleSectionCollapse,
  onTaskClick,
  onStatusToggle,
  onAddTask,
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onTaskMove,
  onSectionReorder,
  sortField = "position",
  sortDirection = "asc",
  profiles,
}: SectionedTaskListViewProps) {
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const pendingScrollRestore = useRef<number | null>(null);

  // Configure drag sensors (same as kanban board)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group and sort tasks by section
  const { unsectionedTasks, tasksBySection } = useMemo(() => {
    const unsectioned = tasks.filter((t) => !t.section_id);
    const bySection = new Map<string, TaskWithProject[]>();

    for (const section of sections) {
      bySection.set(
        section.id,
        tasks.filter((t) => t.section_id === section.id)
      );
    }

    // Apply sorting within each group
    const sortFn = (taskList: TaskWithProject[]) => {
      if (sortField === "position") {
        // For position sort, use section_position
        return [...taskList].sort((a, b) => {
          const posA = a.section_position ?? 0;
          const posB = b.section_position ?? 0;
          return sortDirection === "asc" ? posA - posB : posB - posA;
        });
      }
      return sortTasksWithCompletedLast(taskList, sortField, sortDirection);
    };

    return {
      unsectionedTasks: sortFn(unsectioned),
      tasksBySection: new Map(
        Array.from(bySection.entries()).map(([sectionId, sectionTasks]) => [
          sectionId,
          sortFn(sectionTasks),
        ])
      ),
    };
  }, [tasks, sections, sortField, sortDirection]);

  // IDs for sortable contexts
  const unsectionedTaskIds = useMemo(
    () => unsectionedTasks.map((t) => t.id),
    [unsectionedTasks]
  );

  const sectionSortableIds = useMemo(
    () => sections.map((s) => `section-${s.id}`),
    [sections]
  );

  const profileMap = useMemo(
    () => new Map((profiles ?? []).map((p) => [p.id, p])),
    [profiles]
  );

  // Helper: find which section a task belongs to
  const findTaskSection = useCallback(
    (taskId: string): string | null => {
      const task = tasks.find((t) => t.id === taskId);
      return task?.section_id ?? null;
    },
    [tasks]
  );

  // Helper: determine if an ID is a section sortable
  const isSectionId = useCallback(
    (id: string): boolean => {
      return typeof id === "string" && id.startsWith("section-");
    },
    []
  );

  // Helper: extract section ID from sortable or droppable ID
  const extractSectionId = useCallback((id: string): string => {
    if (id.startsWith("section-drop-")) return id.slice("section-drop-".length);
    return id.slice("section-".length);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const activeId = active.id as string;

      if (isSectionId(activeId)) {
        setActiveSectionId(extractSectionId(activeId));
        setActiveTask(null);
      } else {
        const task = tasks.find((t) => t.id === activeId);
        if (task) {
          setActiveTask(task);
          setActiveSectionId(null);
        }
      }
    },
    [tasks, isSectionId, extractSectionId]
  );

  // Handle drag over (for moving tasks between sections)
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || !activeTask) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Only handle task drags (not section reordering)
      if (isSectionId(activeId)) return;

      // Determine what section the over target belongs to
      let targetSectionId: string | null = null;

      if (overId === UNSECTIONED_ID) {
        targetSectionId = null;
      } else if (isSectionId(overId)) {
        targetSectionId = extractSectionId(overId);
      } else {
        // Over another task - find its section
        targetSectionId = findTaskSection(overId);
      }

      const currentSectionId = activeTask.section_id ?? null;

      // If section changed, update the task's section optimistically
      if (targetSectionId !== currentSectionId) {
        setActiveTask((prev) =>
          prev ? { ...prev, section_id: targetSectionId } : null
        );
      }
    },
    [activeTask, isSectionId, extractSectionId, findTaskSection]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveTask(null);
      setActiveSectionId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Handle section reordering (only for section sortable IDs, not droppable containers)
      if (isSectionId(activeId) && isSectionId(overId) && !overId.startsWith("section-drop-")) {
        const activeSid = extractSectionId(activeId);
        const overSid = extractSectionId(overId);

        if (activeSid !== overSid && onSectionReorder) {
          const oldIndex = sections.findIndex((s) => s.id === activeSid);
          const newIndex = sections.findIndex((s) => s.id === overSid);

          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = [...sections];
            const [moved] = reordered.splice(oldIndex, 1);
            reordered.splice(newIndex, 0, moved);

            const updates = reordered.map((s, i) => ({
              id: s.id,
              position: i,
            }));

            await onSectionReorder(updates);
          }
        }
        return;
      }

      // Handle task movement
      if (!isSectionId(activeId) && onTaskMove) {
        let targetSectionId: string | null = null;
        let targetTasks: TaskWithProject[];

        if (overId === UNSECTIONED_ID) {
          targetSectionId = null;
          targetTasks = unsectionedTasks;
        } else if (isSectionId(overId)) {
          targetSectionId = extractSectionId(overId);
          targetTasks = tasksBySection.get(targetSectionId) || [];
        } else {
          // Dropped on a task
          const overTask = tasks.find((t) => t.id === overId);
          if (!overTask) return;
          targetSectionId = overTask.section_id ?? null;
          targetTasks =
            targetSectionId === null
              ? unsectionedTasks
              : tasksBySection.get(targetSectionId) || [];
        }

        // Calculate position
        const filteredTasks = targetTasks.filter((t) => t.id !== activeId);
        let newPosition: number;

        if (overId === UNSECTIONED_ID || isSectionId(overId)) {
          // Dropped on container - add to end
          newPosition = filteredTasks.length;
        } else {
          // Dropped on a task - insert at that position
          const overIndex = filteredTasks.findIndex((t) => t.id === overId);
          newPosition = overIndex >= 0 ? overIndex : filteredTasks.length;
        }

        // Preserve scroll position across the re-render caused by the task move
        const scrollY = window.scrollY;
        pendingScrollRestore.current = scrollY;
        await onTaskMove(activeId, targetSectionId, newPosition);
        // Restore after React re-renders the DOM
        requestAnimationFrame(() => {
          if (pendingScrollRestore.current !== null) {
            window.scrollTo(0, pendingScrollRestore.current);
            pendingScrollRestore.current = null;
          }
        });
      }
    },
    [
      isSectionId,
      extractSectionId,
      sections,
      onSectionReorder,
      onTaskMove,
      tasks,
      unsectionedTasks,
      tasksBySection,
    ]
  );

  // If no sections exist, render a simple flat list (no DnD overhead)
  if (sections.length === 0) {
    const sortedTasks = sortTasksWithCompletedLast(
      tasks,
      sortField,
      sortDirection
    );

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-card rounded-lg border">
          {sortedTasks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No tasks yet</p>
              <p className="text-sm mt-1">Create a task to get started</p>
            </div>
          ) : (
            <div>
              {sortedTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onTaskClick={
                    onTaskClick as (
                      task: TaskWithProject | import("@/types").Task
                    ) => void
                  }
                  onStatusToggle={
                    onStatusToggle as (
                      task: TaskWithProject | import("@/types").Task
                    ) => void
                  }
                  assignee={task.assignee_id ? (profileMap.get(task.assignee_id) ?? null) : null}
                />
              ))}
            </div>
          )}

          {/* Add task button */}
          {onAddTask && (
            <button
              onClick={() => onAddTask("todo")}
              className="flex items-center gap-2 w-full py-3 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add task</span>
            </button>
          )}
        </div>

        {/* Add section button */}
        {onCreateSection && (
          <div className="mt-2">
            <SectionInlineCreate onSubmit={onCreateSection} />
          </div>
        )}
      </div>
    );
  }

  // Full sectioned view with DnD
  return (
    <div className="max-w-3xl mx-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-3">
          {/* Unsectioned tasks */}
          {unsectionedTasks.length > 0 && (
            <div className="bg-card rounded-lg border">
              <DroppableContainer id={UNSECTIONED_ID}>
                <SortableContext
                  items={unsectionedTaskIds}
                  strategy={verticalListSortingStrategy}
                >
                  {unsectionedTasks.map((task) => (
                    <SortableTaskListItem
                      key={task.id}
                      id={task.id}
                      task={task}
                      onTaskClick={
                        onTaskClick as (
                          task: TaskWithProject | import("@/types").Task
                        ) => void
                      }
                      onStatusToggle={
                        onStatusToggle as (
                          task: TaskWithProject | import("@/types").Task
                        ) => void
                      }
                      assignee={task.assignee_id ? (profileMap.get(task.assignee_id) ?? null) : null}
                    />
                  ))}
                </SortableContext>
              </DroppableContainer>

              {onAddTask && (
                <button
                  onClick={() => onAddTask("todo")}
                  className="flex items-center gap-2 w-full py-3 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Add task</span>
                </button>
              )}
            </div>
          )}

          {/* Empty unsectioned drop zone when no unsectioned tasks */}
          {unsectionedTasks.length === 0 && (
            <DroppableContainer id={UNSECTIONED_ID}>
              <div className="bg-card rounded-lg border border-dashed py-4 text-center text-muted-foreground text-sm">
                Drop tasks here to remove from section
              </div>
            </DroppableContainer>
          )}

          {/* Sections */}
          <SortableContext
            items={sectionSortableIds}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => {
              const sectionTasks = tasksBySection.get(section.id) || [];
              const sectionTaskIds = sectionTasks.map((t) => t.id);
              const isCollapsed = collapsedSectionIds.has(section.id);

              return (
                <div key={section.id} className="bg-card rounded-lg border">
                  <SectionHeader
                    section={section}
                    taskCount={sectionTasks.length}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() =>
                      onToggleSectionCollapse(section.id)
                    }
                    onRename={(name) => onRenameSection?.(section.id, name)}
                    onDelete={() => onDeleteSection?.(section.id)}
                    onAddTask={() => onAddTask?.("todo", section.id)}
                  />

                  {!isCollapsed && (
                    <DroppableContainer id={`section-drop-${section.id}`}>
                      <SortableContext
                        items={sectionTaskIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {sectionTasks.length > 0 ? (
                          sectionTasks.map((task) => (
                            <SortableTaskListItem
                              key={task.id}
                              id={task.id}
                              task={task}
                              onTaskClick={
                                onTaskClick as (
                                  task:
                                    | TaskWithProject
                                    | import("@/types").Task
                                ) => void
                              }
                              onStatusToggle={
                                onStatusToggle as (
                                  task:
                                    | TaskWithProject
                                    | import("@/types").Task
                                ) => void
                              }
                              assignee={task.assignee_id ? (profileMap.get(task.assignee_id) ?? null) : null}
                            />
                          ))
                        ) : (
                          <div className="py-6 text-center text-muted-foreground text-sm">
                            No tasks in this section
                          </div>
                        )}
                      </SortableContext>
                    </DroppableContainer>
                  )}

                  {!isCollapsed && onAddTask && (
                    <button
                      onClick={() => onAddTask("todo", section.id)}
                      className="flex items-center gap-2 w-full py-2 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/40"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add task</span>
                    </button>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="bg-card rounded-lg border shadow-lg">
              <TaskListItem
                task={activeTask}
              />
            </div>
          ) : null}
          {activeSectionId ? (
            <div className="bg-muted/80 rounded-md border shadow-lg px-3 py-2 text-sm font-semibold">
              {sections.find((s) => s.id === activeSectionId)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add section button */}
      {onCreateSection && (
        <div className="mt-2">
          <SectionInlineCreate onSubmit={onCreateSection} />
        </div>
      )}
    </div>
  );
}
