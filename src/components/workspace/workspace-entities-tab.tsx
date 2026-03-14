"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Package, Lightbulb, Users, Network, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEntities, useEntityMutations, generateSlug } from "@/hooks/use-entities";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/types/database";

const ENTITY_TYPE_CONFIG: Record<
  EntityType,
  { label: string; pluralLabel: string; icon: React.ElementType; color: string }
> = {
  product: { label: "Product", pluralLabel: "Products", icon: Package, color: "text-blue-500" },
  initiative: { label: "Initiative", pluralLabel: "Initiatives", icon: Lightbulb, color: "text-amber-500" },
  stakeholder: { label: "Stakeholder", pluralLabel: "Stakeholders", icon: Users, color: "text-green-500" },
};

const ENTITY_TYPES: EntityType[] = ["product", "initiative", "stakeholder"];

function CreateEntityForm({ workspaceId, onCreated }: { workspaceId: string; onCreated: () => void }) {
  const { createEntity, loading } = useEntityMutations();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("product");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createEntity({
      workspace_id: workspaceId,
      entity_type: entityType,
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (result) {
      setName("");
      setDescription("");
      onCreated();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Type</label>
        <div className="flex gap-2">
          {ENTITY_TYPES.map((type) => {
            const config = ENTITY_TYPE_CONFIG[type];
            const Icon = config.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setEntityType(type)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  entityType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="entity-name" className="text-sm font-medium mb-1.5 block">Name</label>
        <Input
          id="entity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g., ${entityType === "product" ? "Online Ordering" : entityType === "initiative" ? "Q2 Replatform" : "Engineering Team"}`}
          autoFocus
        />
        {name.trim() && (
          <p className="text-xs text-muted-foreground mt-1">Slug: @{generateSlug(name)}</p>
        )}
      </div>

      <div>
        <label htmlFor="entity-description" className="text-sm font-medium mb-1.5 block">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="entity-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short tagline"
        />
      </div>

      <Button type="submit" disabled={!name.trim() || loading} className="w-full">
        {loading ? "Creating..." : `Create ${ENTITY_TYPE_CONFIG[entityType].label}`}
      </Button>
    </form>
  );
}

interface WorkspaceEntitiesTabProps {
  workspaceId: string;
}

export function WorkspaceEntitiesTab({ workspaceId }: WorkspaceEntitiesTabProps) {
  const { entities, loading } = useEntities(workspaceId);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<EntityType | "all">("all");

  const filtered = entities.filter((e) => {
    if (filterType !== "all" && e.entity_type !== filterType) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return e.name.toLowerCase().includes(s) || (e.description?.toLowerCase().includes(s) ?? false);
    }
    return true;
  });

  const grouped = ENTITY_TYPES.map((type) => ({
    type,
    config: ENTITY_TYPE_CONFIG[type],
    items: filtered.filter((e) => e.entity_type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="space-y-4">
        {/* Search and create */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            New Entity
          </Button>
        </div>

        {/* Type filter pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium transition-colors",
              filterType === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All ({entities.length})
          </button>
          {ENTITY_TYPES.map((type) => {
            const config = ENTITY_TYPE_CONFIG[type];
            const count = entities.filter((e) => e.entity_type === type).length;
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  filterType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.pluralLabel} ({count})
              </button>
            );
          })}
        </div>

        {/* Entity list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12">
            <Network className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search ? "No entities match your search" : "No entities yet"}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(true)}
                className="mt-3 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create your first entity
              </Button>
            )}
          </div>
        ) : filterType === "all" ? (
          grouped.map(({ type, config, items }) => {
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {config.pluralLabel}
                  </h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="space-y-1">
                  {items.map((entity) => (
                    <Link
                      key={entity.id}
                      href={`/entities/${entity.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entity.name}</p>
                        {entity.description && (
                          <p className="text-sm text-muted-foreground truncate">{entity.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">@{entity.slug}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="space-y-1">
            {filtered.map((entity) => {
              const config = ENTITY_TYPE_CONFIG[entity.entity_type as EntityType];
              const Icon = config.icon;
              return (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entity.name}</p>
                    {entity.description && (
                      <p className="text-sm text-muted-foreground truncate">{entity.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">@{entity.slug}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create entity sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>New Entity</SheetTitle>
          </SheetHeader>
          <CreateEntityForm
            workspaceId={workspaceId}
            onCreated={() => setShowCreate(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
