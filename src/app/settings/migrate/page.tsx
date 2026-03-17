"use client";

import { useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProjects } from "@/hooks/use-projects";
import { useEntities, useEntityMutations } from "@/hooks/use-entities";
import { useEntityLinks, useEntityLinkMutations } from "@/hooks/use-entity-links";
import { useAuth } from "@/hooks/use-auth";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { toast } from "sonner";
import {
  Package,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { Entity, Workspace } from "@/types/database";

type MigrationStep = "products" | "convert" | "verify";

export default function MigratePage() {
  const [step, setStep] = useState<MigrationStep>("products");
  const { workspaces, loading: workspacesLoading } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;

  // Auto-select first workspace once loaded
  if (!selectedWorkspaceId && workspaces.length > 0) {
    setSelectedWorkspaceId(workspaces[0].id);
  }

  return (
    <AppShell>
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Data Migration</h1>
          <p className="text-muted-foreground mt-1">
            Set up the Product → Initiative model for your workspace
          </p>
        </div>

        {/* Workspace selector */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-1.5 block">Workspace</label>
          {workspacesLoading ? (
            <p className="text-sm text-muted-foreground">Loading workspaces...</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspaces found. Create one first.</p>
          ) : (
            <select
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => {
                setSelectedWorkspaceId(e.target.value);
                setStep("products");
              }}
              className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          <StepIndicator
            label="1. Create Products"
            active={step === "products"}
            completed={step === "convert" || step === "verify"}
            onClick={() => setStep("products")}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            label="2. Link Projects"
            active={step === "convert"}
            completed={step === "verify"}
            onClick={() => step !== "products" && setStep("convert")}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            label="3. Verify"
            active={step === "verify"}
            completed={false}
            onClick={() => step === "verify" && setStep("verify")}
          />
        </div>

        {selectedWorkspace ? (
          <>
            {step === "products" && <CreateProductsStep workspace={selectedWorkspace} onNext={() => setStep("convert")} />}
            {step === "convert" && <ConvertProjectsStep workspace={selectedWorkspace} onNext={() => setStep("verify")} />}
            {step === "verify" && <VerifyStep workspace={selectedWorkspace} />}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a workspace above to begin migration.</p>
        )}
      </div>
    </AppShell>
  );
}

function StepIndicator({
  label,
  active,
  completed,
  onClick,
}: {
  label: string;
  active: boolean;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : completed
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {completed && <Check className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

// ============================================================
// Step 1: Create Products
// ============================================================

function CreateProductsStep({ workspace, onNext }: { workspace: Workspace; onNext: () => void }) {
  const { entities: products, loading, refetch } = useEntities(workspace.id, "product");
  const { createEntity, deleteEntity, loading: mutating } = useEntityMutations();
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;

    const result = await createEntity({
      workspace_id: workspace.id,
      entity_type: "product",
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    });

    if (result) {
      setNewName("");
      setNewDescription("");
      refetch();
    }
  }, [newName, newDescription, workspace.id, createEntity, refetch]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEntity(id);
      refetch();
    },
    [deleteEntity, refetch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleCreate();
      }
    },
    [handleCreate]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-1">Create Your Products</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Products are the things you manage — apps, platforms, services. Add each product you
          work on. You&apos;ll link your existing projects to these in the next step.
        </p>

        {/* New product form */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Product name (e.g., Online Ordering)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Input
            placeholder="Short description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={!newName.trim() || mutating} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Products list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products created yet. Add your first product above.</p>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-md border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{product.name}</span>
                    {product.description && (
                      <span className="text-sm text-muted-foreground ml-2">
                        — {product.description}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(product.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={products.length === 0}>
          Next: Link Projects
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Convert Projects → Initiatives
// ============================================================

function ConvertProjectsStep({ workspace, onNext }: { workspace: Workspace; onNext: () => void }) {
  const { user } = useAuth();
  // Fetch ALL user projects (no workspace filter) so we can move projects between workspaces
  const { projects: allProjects, loading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { workspaces } = useWorkspaces();
  const { entities: products } = useEntities(workspace.id, "product");
  const { entities: initiatives, refetch: refetchInitiatives } = useEntities(
    workspace.id,
    "initiative"
  );
  const { createEntity } = useEntityMutations();
  const { createLink } = useEntityLinkMutations();

  // Track which products each project maps to
  const [productSelections, setProductSelections] = useState<Record<string, string[]>>({});
  const [converting, setConverting] = useState<string | null>(null);

  // Show projects that are NOT already in this workspace (available to move here)
  // plus projects already in this workspace that haven't been converted yet
  const projects = allProjects.filter(
    (p) => p.workspace_id !== workspace.id || !p.entity_id
  );

  // Check which projects are already converted (have entity_id set AND are in this workspace)
  const convertedProjectIds = new Set(
    allProjects.filter((p) => p.entity_id && p.workspace_id === workspace.id).map((p) => p.id)
  );

  const toggleProduct = useCallback((projectId: string, productId: string) => {
    setProductSelections((prev) => {
      const current = prev[projectId] || [];
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      return { ...prev, [projectId]: next };
    });
  }, []);

  const convertProject = useCallback(
    async (projectId: string, projectTitle: string) => {
      if (!user) return;

      const selectedProducts = productSelections[projectId] || [];
      if (selectedProducts.length === 0) {
        toast.error("Select at least one product for this project");
        return;
      }

      try {
        setConverting(projectId);

        // 1. Create initiative entity
        const initiative = await createEntity({
          workspace_id: workspace.id,
          entity_type: "initiative",
          name: projectTitle,
        });

        if (!initiative) return;

        // 2. Link initiative to selected products
        for (const productId of selectedProducts) {
          await createLink(initiative.id, productId, "initiative_product");
        }

        // 3. Set projects.entity_id and ensure project is in this workspace
        const supabase = getClient();
        const { error } = await withTimeout(
          supabase
            .from("projects")
            .update({ entity_id: initiative.id, workspace_id: workspace.id })
            .eq("id", projectId),
          TIMEOUTS.MUTATION
        );

        if (error) {
          toast.error("Failed to link project to initiative");
          return;
        }

        toast.success(`Converted "${projectTitle}" to initiative`);
        refetchProjects();
        refetchInitiatives();
      } catch {
        toast.error("Conversion failed");
      } finally {
        setConverting(null);
      }
    },
    [workspace.id, user, productSelections, createEntity, createLink, refetchProjects, refetchInitiatives]
  );

  const unconvertedProjects = projects.filter((p) => !convertedProjectIds.has(p.id));
  const convertedProjects = allProjects.filter((p) => convertedProjectIds.has(p.id));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-1">Link Projects to Products</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Each project becomes an initiative. Select which product(s) each project belongs to.
          Initiatives can span multiple products. Projects from other workspaces will be moved
          into this workspace when converted.
        </p>

        {projectsLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        ) : unconvertedProjects.length === 0 && convertedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects found.</p>
        ) : (
          <div className="space-y-3">
            {/* Unconverted projects */}
            {unconvertedProjects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-md border bg-card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{project.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {project.status}
                    </Badge>
                    {project.workspace_id !== workspace.id && (
                      <Badge variant="secondary" className="text-xs">
                        from: {workspaces.find((w) => w.id === project.workspace_id)?.name ?? "Unknown"}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => convertProject(project.id, project.title)}
                    disabled={
                      converting === project.id ||
                      !(productSelections[project.id]?.length > 0)
                    }
                  >
                    {converting === project.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-1" />
                    )}
                    Convert
                  </Button>
                </div>

                {/* Product selection */}
                <div className="flex flex-wrap gap-2">
                  {products.map((product) => {
                    const selected = (productSelections[project.id] || []).includes(
                      product.id
                    );
                    return (
                      <button
                        key={product.id}
                        onClick={() => toggleProduct(project.id, product.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        <Package className="h-3 w-3 inline mr-1" />
                        {product.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Already converted */}
            {convertedProjects.length > 0 && (
              <>
                <div className="text-sm font-medium text-muted-foreground mt-4 mb-2">
                  Already converted
                </div>
                {convertedProjects.map((project) => {
                  const initiative = initiatives.find(
                    (e) => e.id === project.entity_id
                  );
                  return (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 p-3 rounded-md border bg-green-50/50 dark:bg-green-950/20"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium">{project.title}</span>
                      {initiative && (
                        <span className="text-xs text-muted-foreground">
                          → Initiative: {initiative.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>
          Next: Verify
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Step 3: Verify
// ============================================================

function VerifyStep({ workspace }: { workspace: Workspace }) {
  const { projects } = useProjects(workspace.id);
  const { entities: products } = useEntities(workspace.id, "product");
  const { entities: initiatives } = useEntities(workspace.id, "initiative");

  const convertedCount = projects.filter((p) => p.entity_id).length;
  const unconvertedCount = projects.length - convertedCount;
  const allConverted = unconvertedCount === 0 && projects.length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Migration Summary</h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-md border p-4 text-center">
            <div className="text-2xl font-bold">{products.length}</div>
            <div className="text-sm text-muted-foreground">Products</div>
          </div>
          <div className="rounded-md border p-4 text-center">
            <div className="text-2xl font-bold">{initiatives.length}</div>
            <div className="text-sm text-muted-foreground">Initiatives</div>
          </div>
          <div className="rounded-md border p-4 text-center">
            <div className="text-2xl font-bold">{convertedCount}/{projects.length}</div>
            <div className="text-sm text-muted-foreground">Projects Converted</div>
          </div>
        </div>

        {allConverted ? (
          <div className="flex items-center gap-3 p-4 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">
                Migration complete
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                All projects have been converted to initiatives and linked to products.
              </p>
            </div>
          </div>
        ) : unconvertedCount > 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {unconvertedCount} project{unconvertedCount > 1 ? "s" : ""} not yet converted
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Go back to Step 2 to link remaining projects to products.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No projects found. Create projects first, then come back to migrate.
          </p>
        )}

        {/* Detailed breakdown */}
        {products.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium">Products & Their Initiatives</h3>
            {products.map((product) => (
              <ProductSummaryRow
                key={product.id}
                product={product}
                initiatives={initiatives}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductSummaryRow({
  product,
  initiatives,
}: {
  product: Entity;
  initiatives: Entity[];
}) {
  const { links } = useEntityLinks(product.id);

  const linkedInitiativeIds = new Set(
    links
      .filter((l) => l.link_type === "initiative_product")
      .map((l) => l.source_entity_id === product.id ? l.target_entity_id : l.source_entity_id)
  );

  const linkedInitiatives = initiatives.filter((i) => linkedInitiativeIds.has(i.id));

  return (
    <div className="p-3 rounded-md border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{product.name}</span>
        <Badge variant="secondary" className="text-xs">
          {linkedInitiatives.length} initiative{linkedInitiatives.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      {linkedInitiatives.length > 0 && (
        <div className="ml-6 space-y-1">
          {linkedInitiatives.map((initiative) => (
            <div key={initiative.id} className="text-sm text-muted-foreground">
              └ {initiative.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

