"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Archive, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AppShell, Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { HabitStatsBar } from "@/components/habit/habit-stats-bar";
import { HabitCalendarHeatmap } from "@/components/habit/habit-calendar-heatmap";
import { HabitJournalView } from "@/components/habit/habit-journal-view";
import { HabitCheckInDialog } from "@/components/habit/habit-check-in-dialog";
import { HabitCreateDialog } from "@/components/habit/habit-create-dialog";
import { HabitStreakBadge } from "@/components/habit/habit-streak-badge";
import { useHabit, useHabitMutations } from "@/hooks/use-habits";
import { useHabitEntries } from "@/hooks/use-habit-entries";
import { useHabitStats } from "@/hooks/use-habit-stats";
import { cn } from "@/lib/utils";

interface HabitDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function HabitDetailPage({ params }: HabitDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { habit, loading: habitLoading } = useHabit(id);
  const { entries, loading: entriesLoading } = useHabitEntries(id);
  const stats = useHabitStats(habit, entries);
  const { archiveHabit } = useHabitMutations();

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [backdateDate, setBackdateDate] = useState<Date | undefined>();

  const handleCalendarCellClick = (dateStr: string) => {
    setBackdateDate(new Date(dateStr));
    setCheckInOpen(true);
  };

  const handleArchive = async () => {
    if (!habit) return;
    await archiveHabit(habit.id);
    router.push("/habits");
  };

  if (habitLoading) {
    return (
      <AppShell>
        <Header title="Loading..." />
        <div className="p-6 space-y-4">
          <div className="h-8 bg-muted/60 rounded animate-pulse w-1/3" />
          <div className="h-32 bg-muted/60 rounded animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (!habit) {
    return (
      <AppShell>
        <Header title="Habit not found" />
        <div className="p-6 text-center text-muted-foreground">
          <p>This habit doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link href="/habits" className="text-primary underline text-sm mt-2 inline-block">
            Back to habits
          </Link>
        </div>
      </AppShell>
    );
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

  const frequencyLabel =
    habit.frequency_type === "daily"
      ? "Every day"
      : habit.frequency_type === "weekly" && habit.frequency_days?.length
      ? MON_FIRST.filter((d) => habit.frequency_days!.includes(d))
          .map((d) => DAY_NAMES[d])
          .join(", ")
      : habit.frequency_type === "weekly"
      ? `${habit.frequency_count}× per week`
      : `${habit.frequency_count}× per month`;

  return (
    <AppShell>
      <Header title={habit.title} />

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-8">
        {/* Habit identity + actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-4xl mt-1 shrink-0">{habit.icon ?? "🎯"}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{habit.title}</h1>
                {stats && <HabitStreakBadge streak={stats.currentStreak} size="md" />}
                {habit.is_archived && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    Archived
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>{frequencyLabel}</span>
                {habit.time_goal_minutes && (
                  <>
                    <span>·</span>
                    <span>{habit.time_goal_minutes} min / session</span>
                  </>
                )}
                {habit.description && (
                  <>
                    <span>·</span>
                    <span>{habit.description}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil size={13} />
              Edit
            </Button>
            {!habit.is_archived && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setBackdateDate(undefined);
                  setCheckInOpen(true);
                }}
              >
                <CheckCircle2 size={13} />
                Check in
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Stats
            </h2>
            <HabitStatsBar stats={stats} habit={habit} />
          </section>
        )}

        {/* Calendar heatmap */}
        {stats && stats.calendarData.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Activity
            </h2>
            <div className="rounded-lg border bg-card p-4">
              <HabitCalendarHeatmap
                calendarData={stats.calendarData}
                onCellClick={handleCalendarCellClick}
              />
            </div>
          </section>
        )}

        {/* Journal */}
        <section>
          <div className="rounded-lg border bg-card p-4 lg:p-6">
            <HabitJournalView
              habit={habit}
              entries={entries}
            />
          </div>
        </section>

        {/* Danger zone */}
        {!habit.is_archived && (
          <section className="border-t pt-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Manage
            </h2>
            <Button variant="outline" size="sm" onClick={handleArchive} className="gap-1.5">
              <Archive size={13} />
              Archive habit
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              Archived habits are hidden from the main list but their history is preserved.
            </p>
          </section>
        )}
      </div>

      <HabitCheckInDialog
        open={checkInOpen}
        onOpenChange={(open) => {
          setCheckInOpen(open);
          if (!open) setBackdateDate(undefined);
        }}
        habit={habit}
        prefillDate={backdateDate}
      />
      <HabitCreateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editHabit={habit}
      />
    </AppShell>
  );
}
