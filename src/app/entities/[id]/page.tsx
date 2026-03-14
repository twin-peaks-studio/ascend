"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useEntity, useEntityMutations } from "@/hooks/use-entities";
import { useEntityLinks } from "@/hooks/use-entity-links";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/types/database";

const ENTITY_TYPE_CONFIG: Record<
  EntityType,
  { label: string; icon: React.ElementType; color: string }
> = {
  product: { label: "Product", icon: Package, color: "text-blue-500" },
  initiative: { label: "Initiative", icon: Lightbulb, color: "text-amber-500" },
  stakeholder: { label: "Stakeholder", icon: Users, color: "text-green-500" },
};

type Tab = "overview" | "links" | "memory" | "mentions";

function EntityDetailContent() {
  const params = useParams();
  const router = useRouter();
  const entityId = params.id as string;
  const { entity, loading: entityLoading } = useEntity(entityId);
  const { links, loading: linksLoading } = useEntityLinks(entityId);
  const { updateEntity, deleteEntity, loading: mutating } = useEntityMutations();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContext, setEditContext] = useState("");
  const [showDelete, setShowDelete] = useState(false);

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
            <Link href="/entities">Back to Entities</Link>
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
      router.push("/entities");
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
    { key: "links", label: `Links (${links.length})`, icon: Link2 },
    { key: "memory", label: "Memory", icon: Brain },
    { key: "mentions", label: "Mentions", icon: AtSign },
  ];

  return (
    <>
      <Header title={entity.name} />

      <div className="px-4 lg:px-8 py-4 max-w-3xl mx-auto space-y-4">
        {/* Back link + entity type badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/entities">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Entities
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
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
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
                    Teach the AI what this {config.label.toLowerCase()} is. Include key details, history, and context that should always be known.
                  </p>
                  <Textarea
                    value={editContext}
                    onChange={(e) => setEditContext(e.target.value)}
                    placeholder={`What should the AI know about ${entity.name}?`}
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
                      No foundational context yet. Add context to teach the AI about this {config.label.toLowerCase()}.
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
                return (
                  <Link
                    key={link.id}
                    href={`/entities/${linkedEntity.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <LinkedIcon className={cn("h-5 w-5 shrink-0", linkedConfig?.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{linkedEntity.name}</p>
                      <p className="text-xs text-muted-foreground">{linkedConfig?.label} &middot; {link.link_type.replace(/_/g, " ")}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {activeTab === "memory" && (
          <div className="space-y-4">
            {entity.ai_memory ? (
              <>
                <div className="rounded-lg border bg-card p-4 whitespace-pre-wrap text-sm">
                  {entity.ai_memory}
                </div>
                {entity.memory_refreshed_at && (
                  <p className="text-xs text-muted-foreground">
                    Last refreshed: {new Date(entity.memory_refreshed_at).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  No AI memory yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  AI memory will be available once @mentions and the memory refresh system are built (Phase 4).
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "mentions" && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <AtSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              No mentions yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Mentions will appear here once @mention support is built (Phase 3).
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entity.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {config.label.toLowerCase()} and all its links and mentions. This action cannot be undone.
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
