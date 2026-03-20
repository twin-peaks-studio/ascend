"use client";

import { useState } from "react";
import { Pencil, Check, Package, Rocket, User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEntities } from "@/hooks/use-entities";
import { ENTITY_TYPE_COLORS } from "@/lib/utils/entity-colors";
import { cn } from "@/lib/utils";
import type { Entity, EntityType } from "@/types/database";

const TYPE_LABELS: Record<EntityType, string> = {
  product: "Products",
  initiative: "Initiatives",
  stakeholder: "Stakeholders",
};

const TYPE_ORDER: EntityType[] = ["product", "initiative", "stakeholder"];

const TYPE_ICONS: Record<EntityType, React.ElementType> = {
  product: Package,
  initiative: Rocket,
  stakeholder: User,
};

interface EntityPickerPopoverProps {
  workspaceId: string;
  linkedEntityIds: Set<string>;
  onToggle: (entity: Entity, linked: boolean) => void;
  disabled?: boolean;
}

export function EntityPickerPopover({
  workspaceId,
  linkedEntityIds,
  onToggle,
  disabled,
}: EntityPickerPopoverProps) {
  const { entities } = useEntities(workspaceId);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered: Entity[] = search.trim()
    ? entities.filter((e: Entity) =>
        e.name.toLowerCase().includes(search.toLowerCase())
      )
    : entities;

  // Group by type
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    entities: filtered.filter((e: Entity) => e.entity_type === type),
  })).filter((g) => g.entities.length > 0);

  return (
    <Popover open={open} onOpenChange={(o: boolean) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search entities..."
              className="h-8 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {entities.length === 0 ? "No entities in workspace" : "No matches"}
            </p>
          ) : (
            grouped.map((group) => {
              const colors = ENTITY_TYPE_COLORS[group.type];
              return (
                <div key={group.type}>
                  <p className={cn("text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1", colors.text)}>
                    {group.label}
                  </p>
                  {group.entities.map((entity: Entity) => {
                    const isLinked = linkedEntityIds.has(entity.id);
                    const Icon = TYPE_ICONS[group.type];
                    return (
                      <button
                        key={entity.id}
                        onClick={() => onToggle(entity, isLinked)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn(
                          "flex items-center justify-center h-4 w-4 rounded border",
                          isLinked ? cn(colors.bg, colors.border) : "border-muted-foreground/30"
                        )}>
                          {isLinked && <Check className={cn("h-3 w-3", colors.text)} />}
                        </div>
                        <Icon className={cn("h-3 w-3 shrink-0", colors.text)} />
                        <span className="truncate">{entity.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
