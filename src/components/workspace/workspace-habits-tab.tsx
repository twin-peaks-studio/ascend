"use client";

import { useState } from "react";
import { Plus, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/habit/habit-card";
import { HabitCreateDialog } from "@/components/habit/habit-create-dialog";
import { useWorkspaceHabits } from "@/hooks/use-habits";
import { useHabitEntries } from "@/hooks/use-habit-entries";
import { computeHabitStats } from "@/hooks/use-habit-stats";
import type { Habit } from "@/types";

function HabitCardWithStats({ habit }: { habit: Habit }) {
  const { entries } = useHabitEntries(habit.id);
  const stats = computeHabitStats(habit, entries);
  return <HabitCard habit={habit} stats={stats} />;
}

interface WorkspaceHabitsTabProps {
  workspaceId: string;
}

export function WorkspaceHabitsTab({ workspaceId }: WorkspaceHabitsTabProps) {
  const { habits, loading } = useWorkspaceHabits(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);

  const activeHabits = habits.filter((h) => !h.is_archived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {activeHabits.length} habit{activeHabits.length !== 1 ? "s" : ""} linked to this workspace
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus size={13} />
          New habit
        </Button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && activeHabits.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Flame size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No habits linked to this workspace</p>
          <p className="text-xs mt-1 mb-4">
            Create a habit and link it here, or link an existing habit in its settings.
          </p>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus size={13} />
            Create habit
          </Button>
        </div>
      )}

      {!loading && activeHabits.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeHabits.map((habit) => (
            <HabitCardWithStats key={habit.id} habit={habit} />
          ))}
        </div>
      )}

      <HabitCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultWorkspaceId={workspaceId}
      />
    </div>
  );
}
