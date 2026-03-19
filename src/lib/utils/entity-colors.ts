/**
 * Shared color constants for entity type pills across all task surfaces.
 */

export const ENTITY_TYPE_COLORS = {
  product: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
  initiative: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  stakeholder: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
  },
} as const;

export const ENTITY_TYPE_ICONS = {
  product: "Package",
  initiative: "Rocket",
  stakeholder: "User",
} as const;
