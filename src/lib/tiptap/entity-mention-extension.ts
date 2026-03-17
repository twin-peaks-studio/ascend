/**
 * Entity Mention Extension for Tiptap
 *
 * Custom Tiptap extension that enables #entity mentions in rich text editors.
 * Triggered by typing "#" followed by an entity name. Renders as inline pills
 * with entity type colors (product=blue, initiative=amber, stakeholder=green).
 *
 * The extension stores entity metadata as HTML attributes on a <span> node:
 *   <span data-type="entity-mention" data-entity-id="uuid" data-entity-type="product"
 *         data-entity-slug="online-ordering" class="entity-mention entity-mention--product">
 *     #Online Ordering
 *   </span>
 *
 * Mention persistence (entity_mentions table) is handled separately by
 * parseEntityMentions() + useMentionSync hook — not by this extension.
 */

import Mention from "@tiptap/extension-mention";
import type { MentionOptions } from "@tiptap/extension-mention";

/**
 * Extend the base Mention extension to use "#" trigger and store entity metadata.
 */
export const EntityMention = Mention.extend({
  name: "entityMention",

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-entity-id"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-entity-id": attributes.id,
        }),
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-entity-label") ??
          element.textContent?.replace(/^#/, ""),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-entity-label": attributes.label,
        }),
      },
      entityType: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-entity-type"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-entity-type": attributes.entityType,
        }),
      },
      entitySlug: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-entity-slug"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-entity-slug": attributes.entitySlug,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="entity-mention"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }: { node: { attrs: Record<string, string> }; HTMLAttributes: Record<string, string> }) {
    const entityType = node.attrs.entityType || "product";
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-type": "entity-mention",
        class: `entity-mention entity-mention--${entityType}`,
      },
      `#${node.attrs.label ?? ""}`,
    ];
  },
});

/**
 * Parse entity mention nodes from Tiptap HTML output.
 * Returns array of { entityId, entityType, entitySlug } found in the content.
 *
 * Works by scanning for <span data-type="entity-mention"> elements.
 * Used by the mention sync hook to diff and persist mentions.
 */
export function parseEntityMentions(
  html: string
): Array<{ entityId: string; entityType: string; entitySlug: string }> {
  if (!html || typeof window === "undefined") return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const mentions = doc.querySelectorAll('span[data-type="entity-mention"]');

  const results: Array<{
    entityId: string;
    entityType: string;
    entitySlug: string;
  }> = [];

  const seen = new Set<string>();
  mentions.forEach((el) => {
    const entityId = el.getAttribute("data-entity-id");
    const entityType = el.getAttribute("data-entity-type");
    const entitySlug = el.getAttribute("data-entity-slug");

    if (entityId && !seen.has(entityId)) {
      seen.add(entityId);
      results.push({
        entityId,
        entityType: entityType || "product",
        entitySlug: entitySlug || "",
      });
    }
  });

  return results;
}
