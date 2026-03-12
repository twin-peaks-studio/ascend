"use client";

import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Image,
  Lightbulb,
  Folder,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CaptureDay } from "@/hooks/use-captures";
import type { CaptureWithRelations } from "@/types";
import type { CaptureType } from "@/types/database";

const CAPTURE_TYPE_CONFIG: Record<
  CaptureType,
  { icon: React.ElementType; label: string }
> = {
  meeting_note: { icon: MessageSquare, label: "Meeting" },
  document: { icon: FileText, label: "Document" },
  media: { icon: Image, label: "Media" },
  thought: { icon: Lightbulb, label: "Thought" },
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface CaptureRowProps {
  capture: CaptureWithRelations;
}

function CaptureRow({ capture }: CaptureRowProps) {
  const captureType = capture.capture_type as CaptureType;
  const config = CAPTURE_TYPE_CONFIG[captureType] ?? CAPTURE_TYPE_CONFIG.thought;
  const Icon = config.icon;
  const timeStr = capture.occurred_at || capture.created_at;

  return (
    <Link
      href={`/captures/${capture.id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent group"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {capture.title || "Untitled"}
        </p>
      </div>
      {capture.project && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-1 max-w-[120px]">
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate">{capture.project.title}</span>
        </Badge>
      )}
      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
        {formatTime(timeStr)}
      </span>
    </Link>
  );
}

interface CaptureListProps {
  days: CaptureDay[];
  loading: boolean;
}

export function CaptureList({ days, loading }: CaptureListProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="space-y-1">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-10 bg-muted/50 animate-pulse rounded-lg"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="text-center py-12">
        <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="text-lg font-semibold mb-1">No captures yet</h3>
        <p className="text-sm text-muted-foreground">
          Start capturing meeting notes, thoughts, and documents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <div key={day.date}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
            {day.label}
          </h3>
          <div className="space-y-0.5">
            {day.captures.map((capture) => (
              <CaptureRow key={capture.id} capture={capture} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
