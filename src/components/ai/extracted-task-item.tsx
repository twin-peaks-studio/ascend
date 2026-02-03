"use client";

/**
 * ExtractedTaskItem Component
 *
 * Displays a single extracted task with:
 * - Checkbox for selection
 * - Editable title
 * - Collapsible description
 * - Priority selector
 * - Confidence indicator
 */

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ExtractedTask } from "@/lib/ai/types";

interface ExtractedTaskItemProps {
  task: ExtractedTask;
  onUpdate: (updates: Partial<ExtractedTask>) => void;
  onToggleSelection: () => void;
}

const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function ExtractedTaskItem({
  task,
  onUpdate,
  onToggleSelection,
}: ExtractedTaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const confidencePercent = Math.round(task.confidence * 100);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        task.selected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-muted/30 opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggleSelection}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
            task.selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:border-primary/50"
          )}
        >
          {task.selected && <Check className="h-3 w-3" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          {isEditingTitle ? (
            <Input
              autoFocus
              value={task.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingTitle(false);
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              className="h-8 text-sm"
              maxLength={200}
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-left text-sm font-medium hover:text-primary transition-colors w-full truncate"
            >
              {task.title}
            </button>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority selector */}
            <Select
              value={task.priority}
              onValueChange={(value) =>
                onUpdate({
                  priority: value as ExtractedTask["priority"],
                })
              }
            >
              <SelectTrigger className="h-6 w-auto text-xs px-2 gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
                <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
                <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
                <SelectItem value="urgent">{PRIORITY_LABELS.urgent}</SelectItem>
              </SelectContent>
            </Select>

            {/* Confidence indicator */}
            <Badge
              variant="outline"
              className="h-5 text-xs gap-1 px-1.5 font-normal"
            >
              <Sparkles className="h-3 w-3" />
              {confidencePercent}%
            </Badge>

            {/* Suggested due date */}
            {task.suggestedDueDate && (
              <Badge
                variant="outline"
                className="h-5 text-xs px-1.5 font-normal text-muted-foreground"
              >
                {task.suggestedDueDate}
              </Badge>
            )}

            {/* Expand/collapse description */}
            {task.description && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-5 w-5 ml-auto"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {/* Description (collapsible) */}
          {isExpanded && task.description && (
            <div className="pt-1">
              {isEditingDescription ? (
                <Textarea
                  autoFocus
                  value={task.description || ""}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  onBlur={() => setIsEditingDescription(false)}
                  className="text-xs min-h-[60px] resize-none"
                  maxLength={500}
                />
              ) : (
                <button
                  onClick={() => setIsEditingDescription(true)}
                  className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {task.description}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
