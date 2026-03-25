"use client";

import { useState } from "react";
import { Target, ChevronDown, ChevronRight } from "lucide-react";
import { GoalListRow } from "./goal-list-row";
import type { ProjectWithRelations } from "@/types";

interface GoalsSectionProps {
  goals: ProjectWithRelations[];
}

export function GoalsSection({ goals }: GoalsSectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (goals.length === 0) return null;

  const activeGoals = goals.filter((g) => g.status !== "archived");
  if (activeGoals.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto mb-4">
      <div className="bg-card rounded-lg border">
        {/* Section header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Target className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Goals
          </span>
          <span className="text-xs text-muted-foreground">({activeGoals.length})</span>
        </button>

        {/* Goal rows */}
        {expanded && (
          <div>
            {activeGoals.map((goal) => (
              <GoalListRow key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
