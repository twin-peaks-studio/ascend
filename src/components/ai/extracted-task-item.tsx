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

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, ChevronUp, Sparkles, X, Plus } from "lucide-react";
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
import type { ExtractedTask, ExtractionEntity } from "@/lib/ai/types";

interface ProjectOption {
  id: string;
  title: string;
}

interface ExtractedTaskItemProps {
  task: ExtractedTask;
  onUpdate: (updates: Partial<ExtractedTask>) => void;
  onToggleSelection: () => void;
  /** When provided, show a per-task project selector (used for captures) */
  projects?: ProjectOption[];
  /** Available entities for linking (scoped to source mentions) */
  entities?: ExtractionEntity[];
  /** Full workspace entity list for manual linking */
  allEntities?: ExtractionEntity[];
}

const ENTITY_TYPE_STYLES: Record<string, string> = {
  product: "bg-[#dbeafe] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-blue-300",
  initiative: "bg-[#fef3c7] text-[#92400e] dark:bg-amber-500/20 dark:text-amber-300",
  stakeholder: "bg-[#dcfce7] text-[#166534] dark:bg-green-500/20 dark:text-green-300",
};

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
  projects,
  entities,
  allEntities,
}: ExtractedTaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showEntityDropdown) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEntityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEntityDropdown]);

  // Entity helpers — use allEntities (full workspace list) for the dropdown,
  // fall back to entities (source mentions only) for backwards compat
  const entityPool = allEntities ?? entities ?? [];
  const linkedEntities = entityPool.filter((e) => task.entityIds.includes(e.id));
  const availableEntities = entityPool.filter((e) => !task.entityIds.includes(e.id));
  const filteredAvailable = entitySearch.trim()
    ? availableEntities.filter((e) =>
        e.name.toLowerCase().includes(entitySearch.trim().toLowerCase())
      )
    : availableEntities;

  const removeEntity = (entityId: string) => {
    onUpdate({ entityIds: task.entityIds.filter((id) => id !== entityId) });
  };

  const addEntity = (entityId: string) => {
    onUpdate({ entityIds: [...task.entityIds, entityId] });
    setEntitySearch("");
    setShowEntityDropdown(false);
  };

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

            {/* Project selector (for captures) */}
            {projects && projects.length > 0 && (
              <Select
                value={task.projectId ?? ""}
                onValueChange={(value) =>
                  onUpdate({ projectId: value || undefined })
                }
              >
                <SelectTrigger className={cn(
                  "h-6 w-auto text-xs px-2 gap-1",
                  !task.projectId && "border-destructive text-destructive"
                )}>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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

          {/* Entity pills */}
          {entityPool.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {linkedEntities.map((entity) => (
                <span
                  key={entity.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    ENTITY_TYPE_STYLES[entity.type]
                  )}
                >
                  {entity.name}
                  <button
                    onClick={() => removeEntity(entity.id)}
                    className="hover:opacity-70 -mr-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {availableEntities.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => {
                      setShowEntityDropdown(!showEntityDropdown);
                      setEntitySearch("");
                      if (!showEntityDropdown) {
                        setTimeout(() => searchInputRef.current?.focus(), 0);
                      }
                    }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {showEntityDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md min-w-[200px]">
                      {availableEntities.length > 5 && (
                        <div className="p-1.5 border-b border-border">
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={entitySearch}
                            onChange={(e) => setEntitySearch(e.target.value)}
                            placeholder="Search entities..."
                            className="w-full px-2 py-1 text-xs bg-transparent border border-input rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setShowEntityDropdown(false);
                                setEntitySearch("");
                              }
                              if (e.key === "Enter" && filteredAvailable.length === 1) {
                                addEntity(filteredAvailable[0].id);
                              }
                            }}
                          />
                        </div>
                      )}
                      <div className="py-1 max-h-[200px] overflow-y-auto">
                        {filteredAvailable.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No matching entities
                          </div>
                        ) : (
                          filteredAvailable.map((entity) => (
                            <button
                              key={entity.id}
                              onClick={() => addEntity(entity.id)}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors"
                            >
                              <span
                                className={cn(
                                  "inline-block w-2 h-2 rounded-full shrink-0",
                                  entity.type === "product" && "bg-blue-500",
                                  entity.type === "initiative" && "bg-amber-500",
                                  entity.type === "stakeholder" && "bg-green-500"
                                )}
                              />
                              <span className="truncate">{entity.name}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground capitalize shrink-0">
                                {entity.type}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                  maxLength={3000}
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
