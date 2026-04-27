"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHabitMutations } from "@/hooks/use-habits";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { cn } from "@/lib/utils";
import type { Habit, HabitFrequencyType } from "@/types";

const HABIT_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

const HABIT_ICONS = ["📚", "🏃", "🧘", "💪", "✍️", "🎯", "🍎", "💧", "🧠", "📊", "🎨", "🎵"];

interface HabitCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editHabit?: Habit;
  defaultWorkspaceId?: string;
  onSuccess?: (habit: Habit) => void;
}

export function HabitCreateDialog({
  open,
  onOpenChange,
  editHabit,
  defaultWorkspaceId,
  onSuccess,
}: HabitCreateDialogProps) {
  const { createHabit, updateHabit, loading } = useHabitMutations();
  const { workspaces } = useWorkspaces();

  const isEditing = !!editHabit;

  const [title, setTitle] = useState(editHabit?.title ?? "");
  const [description, setDescription] = useState(editHabit?.description ?? "");
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>(
    editHabit?.frequency_type ?? "daily"
  );
  const [frequencyCount, setFrequencyCount] = useState(
    editHabit?.frequency_count?.toString() ?? "1"
  );
  const [timeGoal, setTimeGoal] = useState(
    editHabit?.time_goal_minutes?.toString() ?? ""
  );
  const [selectedColor, setSelectedColor] = useState(editHabit?.color ?? HABIT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(editHabit?.icon ?? "🎯");
  const [workspaceId, setWorkspaceId] = useState<string>(
    editHabit?.workspace_id ?? defaultWorkspaceId ?? ""
  );

  const handleSubmit = async () => {
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      frequency_type: frequencyType,
      frequency_count:
        frequencyType === "daily" ? 1 : parseInt(frequencyCount, 10) || 1,
      time_goal_minutes: timeGoal ? parseInt(timeGoal, 10) : null,
      color: selectedColor,
      icon: selectedIcon,
      workspace_id: workspaceId || null,
    };

    if (isEditing && editHabit) {
      const updated = await updateHabit(editHabit.id, payload);
      if (updated) {
        onSuccess?.(updated);
        onOpenChange(false);
      }
    } else {
      const created = await createHabit(payload);
      if (created) {
        onSuccess?.(created);
        onOpenChange(false);
        // Reset
        setTitle("");
        setDescription("");
        setFrequencyType("daily");
        setFrequencyCount("1");
        setTimeGoal("");
        setWorkspaceId("");
      }
    }
  };

  const frequencyLabel =
    frequencyType === "daily"
      ? "Every day"
      : frequencyType === "weekly"
      ? `${frequencyCount}× per week`
      : `${frequencyCount}× per month`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit habit" : "Create habit"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Icon + Title */}
          <div className="flex gap-2 items-start">
            <div>
              <Label className="sr-only">Icon</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger className="w-16 text-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HABIT_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon} className="text-xl">
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Name</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Daily reading, Fasting, Morning run"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>
              Description{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this habit about? Any rules or notes for yourself."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <div className="flex gap-2">
              <Select
                value={frequencyType}
                onValueChange={(v) => setFrequencyType(v as HabitFrequencyType)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">X times per week</SelectItem>
                  <SelectItem value="monthly">X times per month</SelectItem>
                </SelectContent>
              </Select>
              {frequencyType !== "daily" && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="1"
                    max={frequencyType === "weekly" ? "7" : "31"}
                    value={frequencyCount}
                    onChange={(e) => setFrequencyCount(e.target.value)}
                    className="w-16 text-center"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    × / {frequencyType === "weekly" ? "wk" : "mo"}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{frequencyLabel}</p>
          </div>

          {/* Time goal */}
          <div className="space-y-1.5">
            <Label>
              Time goal per session{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="480"
                placeholder="e.g. 30"
                value={timeGoal}
                onChange={(e) => setTimeGoal(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              If set, check-ins will require logging time to count as complete.
            </p>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {HABIT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform hover:scale-110",
                    selectedColor === color && "ring-2 ring-offset-2 ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Workspace */}
          <div className="space-y-1.5">
            <Label>
              Link to workspace{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Select
              value={workspaceId || "none"}
              onValueChange={(v) => setWorkspaceId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Personal (no workspace)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Personal (no workspace)</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? "Saving..." : isEditing ? "Save changes" : "Create habit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
