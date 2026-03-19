"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Lightbulb,
  Users,
  Pencil,
  Trash2,
  Link2,
  Brain,
  AtSign,
  Save,
  X,
  BookOpen,
  Plus,
  MoreHorizontal,
  CheckSquare,
  Circle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEntity, useEntityMutations } from "@/hooks/use-entities";
import { useEntityLinks } from "@/hooks/use-entity-links";
import { useEntityContextEntries, useEntityContextEntryMutations } from "@/hooks/use-entity-context-entries";
import { useEntityMentionsByEntity } from "@/hooks/use-entity-mentions";
import { useInitiativeTaskRollup, useProductTaskRollup, type TaskRollupSummary } from "@/hooks/use-entity-task-rollup";
import { useMemoryRefresh } from "@/hooks/use-memory-refresh";
import { EntityTasksTab } from "@/components/entity/entity-tasks-tab";
import { cn } from "@/lib/utils";
import type { EntityType, EntityContextEntry } from "@/types/database";

const ENTITY_TYPE_CONFIG: Record<
  EntityType,
  { label: string; icon: React.ElementType; color: string }
> = {
  product: { label: "Product", icon: Package, color: "text-blue-500" },
  initiative: { label: "Initiative", icon: Lightbulb, color: "text-amber-500" },
  stakeholder: { label: "Stakeholder", icon: Users, color: "text-green-500" },
};

type Tab = "overview" | "tasks" | "journal" | "links" | "memory" | "mentions";

function JournalEntryCard({
  entry,
  entityId,
  onUpdate,
  onDelete,
  mutating,
}: {
  entry: EntityContextEntry;
  entityId: string;
  onUpdate: (id: string, entityId: string, content: string) => Promise<boolean>;
  onDelete: (id: string, entityId: string) => Promise<boolean>;
  mutating: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);

  const handleSave = async () => {
    const success = await onUpdate(entry.id, entityId, editContent);
    if (success) setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setEditContent(entry.content); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!editContent.trim() || mutating}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm whitespace-pre-wrap flex-1">{entry.content}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(entry.id, entityId)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(entry.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {entry.updated_at !== entry.created_at && " (edited)"}
          </p>
        </>
      )}
    </div>
  );
}

function TaskRollupBar({ summary }: { summary: TaskRollupSummary }) {
  if (summary.total === 0) {
    return <span className="text-xs text-muted-foreground">No tasks</span>;
  }

  const pctDone = Math.round((summary.done / summary.total) * 100);
  const pctInProgress = Math.round((summary.in_progress / summary.total) * 100);
  const pctTodo = Math.round((summary.todo / summary.total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{summary.total} task{summary.total !== 1 ? "s" : ""}</span>
        <span className="text-muted-foreground/50">&middot;</span>
        <span>{summary.todo} to do</span>
        <span>{summary.in_progress} in progress</span>
        <span className="text-green-600 dark:text-green-400">{summary.done} done</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
        {pctDone > 0 && (
          <div className="bg-green-500 h-full" style={{ width: `${pctDone}%` }} />
        )}
        {pctInProgress > 0 && (
          <div className="bg-blue-500 h-full" style={{ width: `${pctInProgress}%` }} />
        )}
        {pctTodo > 0 && (
          <div className="bg-muted-foreground/20 h-full" style={{ width: `${pctTodo}%` }} />
        )}
      </div>
    </div>
  );
}

function EntityDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityId = params.id as string;
  const workspaceId = searchParams.get("workspace");

  const { entity, loading: entityLoading } = useEntity(entityId);
  const { links, loading: linksLoading } = useEntityLinks(entityId);
  const { entries, loading: entriesLoading } = useEntityContextEntries(entityId);
  const { updateEntity, deleteEntity, loading: mutating } = useEntityMutations();
  const { createEntry, updateEntry, deleteEntry, loading: entryMutating } = useEntityContextEntryMutations();
  const { mentions } = useEntityMentionsByEntity(entityId);
  const { refresh: refreshMemory, refreshing: memoryRefreshing } = useMemoryRefresh(entityId);

  // Derive linked initiative IDs for product task rollup
  const linkedInitiativeIds = useMemo(() => {
    if (!entity || entity.entity_type !== "product") return [];
    return links
      .filter((l) => l.link_type === "initiative_product")
      .map((l) => {
        const isSource = l.source_entity_id === entityId;
        return isSource ? l.target_entity_id : l.source_entity_id;
      });
  }, [entity, links, entityId]);

  // Task rollup hooks — only one fires based on entity type
  const { data: initiativeRollup = [] } = useInitiativeTaskRollup(
    entity?.entity_type === "initiative" ? entityId : null
  );
  const { data: productRollup = [] } = useProductTaskRollup(
    entity?.entity_type === "product" ? entityId : null,
    linkedInitiativeIds
  );

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContext, setEditContext] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [editingGuidance, setEditingGuidance] = useState(false);
  const [guidanceText, setGuidanceText] = useState("");

  // Build the back link — navigate to workspace if we came from one
  const backHref = workspaceId ? `/workspaces/${workspaceId}` : "/";
  const backLabel = workspaceId ? "Workspace" : "Home";

  if (entityLoading) {
    return (
      <>
        <Header title="Loading..." />
        <div className="px-4 lg:px-8 py-4 max-w-3xl mx-auto">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </>
    );
  }

  if (!entity) {
    return (
      <>
        <Header title="Not Found" />
        <div className="px-4 lg:px-8 py-4 max-w-3xl mx-auto text-center py-12">
          <p className="text-muted-foreground">Entity not found</p>
          <Button variant="outline" size="sm" asChild className="mt-3">
            <Link href={backHref}>Back to {backLabel}</Link>
          </Button>
        </div>
      </>
    );
  }

  const config = ENTITY_TYPE_CONFIG[entity.entity_type as EntityType];
  const Icon = config.icon;

  const startEditing = () => {
    setEditName(entity.name);
    setEditDescription(entity.description ?? "");
    setEditContext(entity.foundational_context ?? "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEditing = async () => {
    const result = await updateEntity(entity.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      foundational_context: editContext.trim() || undefined,
    });
    if (result) {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    const success = await deleteEntity(entity.id);
    if (success) {
      router.push(backHref);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.trim()) return;
    const result = await createEntry(entity.id, newEntry);
    if (result) {
      setNewEntry("");
      setShowNewEntry(false);
    }
  };

  // Categorize links
  const linkedEntities = links.map((link) => {
    const isSource = link.source_entity_id === entityId;
    const linkedEntity = isSource ? link.target_entity : link.source_entity;
    return { link, entity: linkedEntity };
  }).filter((l) => l.entity);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Pencil },
    { key: "tasks", label: "Tasks", icon: CheckSquare },
    { key: "journal", label: `Journal (${entries.length})`, icon: BookOpen },
    { key: "links", label: `Links (${links.length})`, icon: Link2 },
    { key: "memory", label: "Memory", icon: Brain },
    { key: "mentions", label: `Mentions (${mentions.length})`, icon: AtSign },
  ];

  return (
    <>
      <Header title={entity.name} />

      <div className="px-4 lg:px-8 py-4 max-w-3xl mx-auto space-y-4">
        {/* Back link + entity type badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {backLabel}
              </Link>
            </Button>
            <span className={cn("flex items-center gap-1.5 text-sm font-medium", config.color)}>
              <Icon className="h-4 w-4" />
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <>
                <Button variant="ghost" size="sm" onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <TabIcon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {editing ? (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Short tagline"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Foundational Context</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Permanent truth about this {config.label.toLowerCase()}. This is always preserved — never summarized away by the AI.
                  </p>
                  <Textarea
                    value={editContext}
                    onChange={(e) => setEditContext(e.target.value)}
                    placeholder={`What should always be known about ${entity.name}?`}
                    rows={8}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveEditing} disabled={!editName.trim() || mutating} className="gap-1.5">
                    <Save className="h-4 w-4" />
                    {mutating ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={cancelEditing}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-semibold">{entity.name}</h2>
                  {entity.description && (
                    <p className="text-muted-foreground mt-1">{entity.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">@{entity.slug}</p>
                </div>

                {entity.foundational_context ? (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Foundational Context</h3>
                    <div className="rounded-lg border bg-card p-4 whitespace-pre-wrap text-sm">
                      {entity.foundational_context}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No foundational context yet. Add permanent truths about this {config.label.toLowerCase()}.
                    </p>
                    <Button variant="outline" size="sm" onClick={startEditing}>
                      Add Context
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <EntityTasksTab entityId={entity.id} />
        )}

        {activeTab === "journal" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Evolving knowledge about this {config.label.toLowerCase()}. Add context over time — the AI memory refresh will synthesize it all.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowNewEntry(true)}
                className="gap-1.5 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </div>

            {/* New entry form */}
            {showNewEntry && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <Textarea
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  placeholder={`What do you want to record about ${entity.name}? E.g., "Prefers async communication", "Recently migrated to React", "Reports to VP of Product"...`}
                  rows={4}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setShowNewEntry(false); setNewEntry(""); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddEntry} disabled={!newEntry.trim() || entryMutating}>
                    {entryMutating ? "Adding..." : "Add Entry"}
                  </Button>
                </div>
              </div>
            )}

            {/* Entries list */}
            {entriesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : entries.length === 0 && !showNewEntry ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  No journal entries yet.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Record everything you know about this {config.label.toLowerCase()} — decisions made, quirks, constraints, history.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowNewEntry(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first entry
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <JournalEntryCard
                    key={entry.id}
                    entry={entry}
                    entityId={entity.id}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                    mutating={entryMutating}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "links" && (
          <div className="space-y-3">
            {linksLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : linkedEntities.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No linked entities yet. Links are created during migration or from the project properties panel.
                </p>
              </div>
            ) : (
              linkedEntities.map(({ link, entity: linkedEntity }) => {
                if (!linkedEntity) return null;
                const linkedConfig = ENTITY_TYPE_CONFIG[linkedEntity.entity_type as EntityType];
                const LinkedIcon = linkedConfig?.icon ?? Link2;

                // Find task rollup for this linked entity (product → initiative rollup)
                const rollup = entity.entity_type === "product"
                  ? productRollup.find((r) => r.entityId === linkedEntity.id)
                  : null;

                return (
                  <Link
                    key={link.id}
                    href={`/entities/${linkedEntity.id}${workspaceId ? `?workspace=${workspaceId}` : ""}`}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <LinkedIcon className={cn("h-5 w-5 shrink-0 mt-0.5", linkedConfig?.color)} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div>
                        <p className="font-medium truncate">{linkedEntity.name}</p>
                        <p className="text-xs text-muted-foreground">{linkedConfig?.label} &middot; {link.link_type.replace(/_/g, " ")}</p>
                      </div>
                      {rollup && <TaskRollupBar summary={rollup.summary} />}
                    </div>
                  </Link>
                );
              })
            )}

            {/* Initiative: show task list directly */}
            {entity.entity_type === "initiative" && initiativeRollup.length > 0 && (
              <div className="mt-4 space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                </h3>
                {initiativeRollup.map((rollup) => (
                  <div key={rollup.projectId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: rollup.projectColor }}
                      />
                      <span className="text-sm font-medium">{rollup.projectTitle}</span>
                    </div>
                    <TaskRollupBar summary={rollup.summary} />
                    {/* Show individual tasks */}
                    <div className="rounded-lg border bg-card divide-y">
                      {rollup.tasks.filter((t) => t.status !== "done").slice(0, 10).map((task) => (
                        <div key={task.id} className="flex items-center gap-2.5 py-2 px-3">
                          {task.status === "done" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Circle className={cn(
                              "h-4 w-4 shrink-0",
                              task.status === "in-progress" ? "text-blue-500" : "text-muted-foreground"
                            )} />
                          )}
                          <span className="text-sm truncate">{task.title}</span>
                        </div>
                      ))}
                      {rollup.tasks.filter((t) => t.status !== "done").length > 10 && (
                        <div className="py-2 px-3 text-xs text-muted-foreground text-center">
                          +{rollup.tasks.filter((t) => t.status !== "done").length - 10} more tasks
                        </div>
                      )}
                      {rollup.tasks.filter((t) => t.status !== "done").length === 0 && (
                        <div className="py-3 px-3 text-xs text-muted-foreground text-center">
                          All tasks completed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "memory" && (
          <div className="space-y-4">
            {/* Header with refresh button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Synthesized from foundational context, journal entries, and #mentions.
              </p>
              <Button
                size="sm"
                variant={entity.ai_memory ? "outline" : "default"}
                onClick={() => refreshMemory()}
                disabled={memoryRefreshing || editingGuidance}
                className="gap-1.5 shrink-0"
              >
                {memoryRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synthesizing...
                  </>
                ) : (
                  <>
                    {entity.ai_memory ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {entity.ai_memory ? "Refresh" : "Generate Memory"}
                  </>
                )}
              </Button>
            </div>

            {/* Memory Guidance section */}
            <div className="space-y-2">
              {editingGuidance ? (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Guidance</h4>
                    <p className="text-xs text-muted-foreground">
                      Persistent corrections and instructions for the AI. These override conflicting information from other sources and persist across refreshes.
                    </p>
                  </div>
                  <Textarea
                    value={guidanceText}
                    onChange={(e) => setGuidanceText(e.target.value)}
                    placeholder="e.g., &quot;The launch date was moved to Q3 2026&quot; or &quot;Ignore mentions of the old pricing model&quot;"
                    rows={4}
                    className="text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingGuidance(false)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={mutating}
                      onClick={async () => {
                        const value = guidanceText.trim() || null;
                        await updateEntity(entity.id, { memory_guidance: value });
                        setEditingGuidance(false);
                      }}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : entity.memory_guidance ? (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Guidance</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setGuidanceText(entity.memory_guidance ?? "");
                        setEditingGuidance(true);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entity.memory_guidance}</p>
                </div>
              ) : (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setGuidanceText("");
                    setEditingGuidance(true);
                  }}
                >
                  + Add guidance to steer AI memory synthesis
                </button>
              )}
            </div>

            {/* Loading state */}
            {memoryRefreshing && !entity.ai_memory && (
              <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                <Loader2 className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
                <div>
                  <p className="text-sm font-medium">Synthesizing memory...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reading foundational context, journal entries, and mentions to build a comprehensive memory.
                  </p>
                </div>
              </div>
            )}

            {/* Memory content */}
            {entity.ai_memory ? (
              <>
                {memoryRefreshing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Refreshing memory...
                  </div>
                )}
                <div className="rounded-lg border bg-card p-5 prose prose-sm dark:prose-invert max-w-none">
                  {entity.ai_memory.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) {
                      return (
                        <h3 key={i} className="text-sm font-semibold mt-4 mb-2 first:mt-0">
                          {line.replace("## ", "")}
                        </h3>
                      );
                    }
                    if (line.startsWith("- ")) {
                      return (
                        <p key={i} className="text-sm pl-3 py-0.5 border-l-2 border-muted-foreground/20 mb-1">
                          {line.replace("- ", "")}
                        </p>
                      );
                    }
                    if (line.trim() === "") {
                      return <div key={i} className="h-2" />;
                    }
                    return (
                      <p key={i} className="text-sm mb-1">
                        {line}
                      </p>
                    );
                  })}
                </div>
                {entity.memory_refreshed_at && (
                  <p className="text-xs text-muted-foreground">
                    Last refreshed: {new Date(entity.memory_refreshed_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </>
            ) : !memoryRefreshing ? (
              <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                <Brain className="h-8 w-8 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm font-medium">No AI memory yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Click &quot;Generate Memory&quot; to synthesize knowledge from foundational context, journal entries, and #mentions into a structured memory document.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "mentions" && (
          mentions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <AtSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">
                No mentions yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Use # in notes or captures to mention this entity.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mentions.map((mention) => {
                const isCapture = mention.source_type === "capture";
                const MentionIcon = isCapture ? Lightbulb : FileText;
                const typeLabel = mention.source_type === "capture" ? "Capture"
                  : mention.source_type === "note" ? "Note"
                  : mention.source_type === "task_description" ? "Task"
                  : "Comment";
                const href = isCapture
                  ? `/captures/${mention.source_id}${workspaceId ? `?workspace=${workspaceId}` : ""}`
                  : undefined; // Notes need project context — link only captures for now

                const content = (
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <MentionIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {mention.source_title ?? "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel} &middot; {new Date(mention.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );

                return href ? (
                  <Link key={mention.id} href={href}>{content}</Link>
                ) : (
                  <div key={mention.id}>{content}</div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entity.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {config.label.toLowerCase()} and all its links, journal entries, and mentions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function EntityDetailPage() {
  return (
    <AppShell>
      <EntityDetailContent />
    </AppShell>
  );
}
