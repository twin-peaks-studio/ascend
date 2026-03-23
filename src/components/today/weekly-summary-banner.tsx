"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeeklySummary } from "@/hooks/use-weekly-summary";

interface WeeklySummaryBannerProps {
  summary: WeeklySummary;
}

/**
 * Renders the weekly focus summary returned by /api/ai/weekly-summary.
 * The summary uses markdown-style headings (## Heading) and bullet points (- item).
 * We split and render these without a full markdown parser.
 */
export function WeeklySummaryBanner({ summary }: WeeklySummaryBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sections = parseSummary(summary.summary);

  return (
    <div className="rounded-lg border bg-card p-4 mb-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Weekly Focus</span>
          <span className="text-xs text-muted-foreground">
            {summary.entityCount} {summary.entityCount === 1 ? "entity" : "entities"}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {sections.map((section, i) => (
            <div key={i}>
              {section.heading && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  {section.heading}
                </h3>
              )}
              {section.lines.map((line, j) => {
                if (line.type === "bullet") {
                  return (
                    <div key={j} className="flex gap-2 text-sm text-foreground mb-1">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      <span dangerouslySetInnerHTML={{ __html: formatInline(line.text) }} />
                    </div>
                  );
                }
                return (
                  <p key={j} className={cn("text-sm text-foreground", j > 0 && "mt-1")}>
                    {line.text}
                  </p>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

interface ParsedLine {
  type: "text" | "bullet";
  text: string;
}

interface ParsedSection {
  heading: string | null;
  lines: ParsedLine[];
}

function parseSummary(text: string): ParsedSection[] {
  const rawLines = text.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection = { heading: null, lines: [] };

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      // Push current section if it has content
      if (current.lines.length > 0 || current.heading) {
        sections.push(current);
      }
      current = { heading: line.slice(3).trim(), lines: [] };
    } else if (line.startsWith("- ")) {
      current.lines.push({ type: "bullet", text: line.slice(2).trim() });
    } else {
      current.lines.push({ type: "text", text: line });
    }
  }

  if (current.lines.length > 0 || current.heading) {
    sections.push(current);
  }

  return sections;
}

/**
 * Convert **bold** markdown to <strong> tags for inline rendering.
 * Only handles bold — this is all the AI output uses.
 */
function formatInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
