"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEntities, useEntityMutations, generateSlug } from "@/hooks/use-entities";

function CreateProductForm({ workspaceId, onCreated }: { workspaceId: string; onCreated: () => void }) {
  const { createEntity, loading } = useEntityMutations();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createEntity({
      workspace_id: workspaceId,
      entity_type: "product",
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
        <label htmlFor="product-name" className="text-sm font-medium mb-1.5 block">Name</label>
        <Input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Online Ordering, Mobile App, POS"
          autoFocus
        />
        {name.trim() && (
          <p className="text-xs text-muted-foreground mt-1">Slug: @{generateSlug(name)}</p>
        )}
      </div>

      <div>
        <label htmlFor="product-description" className="text-sm font-medium mb-1.5 block">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="product-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short tagline for this product"
        />
      </div>

      <Button type="submit" disabled={!name.trim() || loading} className="w-full">
        {loading ? "Creating..." : "Create Product"}
      </Button>
    </form>
  );
}

interface WorkspaceProductsTabProps {
  workspaceId: string;
}

export function WorkspaceProductsTab({ workspaceId }: WorkspaceProductsTabProps) {
  const { entities: products, loading } = useEntities(workspaceId, "product");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? products.filter((p) => {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s) || (p.description?.toLowerCase().includes(s) ?? false);
      })
    : products;

  return (
    <>
      <div className="space-y-4">
        {/* Search and create */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        </div>

        {/* Products list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search ? "No products match your search" : "No products yet"}
            </p>
            {!search && (
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Products are the things you ship — apps, platforms, services.
              </p>
            )}
            {!search && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create your first product
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((product) => (
              <Link
                key={product.id}
                href={`/entities/${product.id}`}
                className="block p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{product.name}</p>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{product.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">@{product.slug}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create product sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>New Product</SheetTitle>
          </SheetHeader>
          <CreateProductForm
            workspaceId={workspaceId}
            onCreated={() => setShowCreate(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
