"use client";

import { useState, useMemo } from "react";
import { Plus, Target } from "lucide-react";
import { AppShell, Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/habit/habit-card";
import { HabitCreateDialog } from "@/components/habit/habit-create-dialog";
import { HabitLogView } from "@/components/habit/habit-log-view";
import { useHabits } from "@/hooks/use-habits";
import { useHabitEntries } from "@/hooks/use-habit-entries";
import { computeHabitStats } from "@/hooks/use-habit-stats";
import { cn } from "@/lib/utils";
import type { Habit } from "@/types";

type FilterMode = "active" | "archived" | "all" | "log";

function HabitCardWithStats({ habit }: { habit: Habit }) {
  const { entries } = useHabitEntries(habit.id);
  const stats = computeHabitStats(habit, entries);
  return <HabitCard habit={habit} stats={stats} />;
}

export default function HabitsPage() {
  const { habits, loading } = useHabits();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("active");

  const filteredHabits = useMemo(() => {
    if (filter === "active") return habits.filter((h) => !h.is_archived);
    if (filter === "archived") return habits.filter((h) => h.is_archived);
    return habits;
  }, [habits, filter]);

  const activeCount = habits.filter((h) => !h.is_archived).length;
  const archivedCount = habits.filter((h) => h.is_archived).length;

  const tabs: { value: FilterMode; label: string; count?: number }[] = [
    { value: "active", label: "Active", count: activeCount },
    { value: "archived", label: "Archived", count: archivedCount },
    { value: "all", label: "All", count: habits.length },
    { value: "log", label: "Log" },
  ];

  return (
    <AppShell>
      <Header
        title="Habits"
        showCreateButton
        quickCreateLabel="New Habit"
        onQuickCreate={() => setCreateOpen(true)}
      />

      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                filter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn("text-xs ml-1", filter === tab.value ? "opacity-70" : "text-muted-foreground")}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Log view */}
        {filter === "log" && <HabitLogView habits={habits} />}

        {/* Habit grid views */}
        {filter !== "log" && (
          <>
            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 rounded-lg bg-muted/60 animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredHabits.length === 0 && (
              <div className="text-center py-20">
                <Target size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
                {filter === "active" ? (
                  <>
                    <h3 className="font-semibold mb-1">No habits yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Build consistency by tracking what you do regularly.
                    </p>
                    <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                      <Plus size={14} />
                      Create your first habit
                    </Button>
                  </>
                ) : filter === "archived" ? (
                  <>
                    <h3 className="font-semibold mb-1">No archived habits</h3>
                    <p className="text-sm text-muted-foreground">
                      Archived habits will appear here.
                    </p>
                  </>
                ) : (
                  <h3 className="font-semibold mb-1">No habits found</h3>
                )}
              </div>
            )}

            {/* Habits grid */}
            {!loading && filteredHabits.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHabits.map((habit) => (
                  <HabitCardWithStats key={habit.id} habit={habit} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <HabitCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
