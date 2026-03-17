/**
 * Entity Mention Suggestion Configuration
 *
 * Bridges the Tiptap suggestion plugin with our React dropdown component.
 * Uses a simple absolute-positioned div instead of tippy.js for minimal dependencies.
 */

import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import {
  MentionSuggestionList,
  type EntitySuggestionItem,
  type MentionSuggestionListRef,
} from "@/components/shared/entity-mention-suggestion";
import type { Entity } from "@/types/database";

/**
 * Create suggestion options for the entity mention extension.
 *
 * @param getEntities - Function that returns the current list of workspace entities.
 *                      Called on every keystroke inside a #mention query.
 *                      Should return a cached/memoized array (e.g., from React Query).
 */
export function createEntityMentionSuggestion(
  getEntities: () => Entity[]
): Omit<SuggestionOptions<EntitySuggestionItem>, "editor"> {
  return {
    char: "#",
    allowSpaces: true,

    items: ({ query }: { query: string }): EntitySuggestionItem[] => {
      const entities = getEntities();
      const lowerQuery = query.toLowerCase();

      return entities
        .filter(
          (entity) =>
            entity.name.toLowerCase().includes(lowerQuery) ||
            entity.slug.includes(lowerQuery)
        )
        .slice(0, 8)
        .map((entity) => ({
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          entity_type: entity.entity_type,
        }));
    },

    render: () => {
      let component: ReactRenderer<MentionSuggestionListRef> | null = null;
      let popupEl: HTMLDivElement | null = null;

      return {
        onStart: (props: SuggestionProps<EntitySuggestionItem>) => {
          component = new ReactRenderer(MentionSuggestionList, {
            props: {
              items: props.items,
              command: props.command,
            },
            editor: props.editor,
          });

          popupEl = document.createElement("div");
          popupEl.style.position = "absolute";
          popupEl.style.zIndex = "50";
          popupEl.appendChild(component.element);
          document.body.appendChild(popupEl);

          updatePopupPosition(popupEl, props.clientRect);
        },

        onUpdate: (props: SuggestionProps<EntitySuggestionItem>) => {
          component?.updateProps({
            items: props.items,
            command: props.command,
          });

          updatePopupPosition(popupEl, props.clientRect);
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            popupEl?.remove();
            return true;
          }

          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          popupEl?.remove();
          component?.destroy();
          popupEl = null;
          component = null;
        },
      };
    },
  };
}

function updatePopupPosition(
  el: HTMLDivElement | null,
  clientRect: (() => DOMRect | null) | null | undefined
) {
  if (!el || !clientRect) return;
  const rect = clientRect();
  if (!rect) return;

  el.style.left = `${rect.left + window.scrollX}px`;
  el.style.top = `${rect.bottom + window.scrollY + 4}px`;
}
