"use client";

import { File, Download, Trash2, Image, FileText, FileArchive, FileAudio, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/hooks/use-attachments";
import type { Attachment } from "@/types";

interface AttachmentsListProps {
  attachments: Attachment[];
  onDownload?: (attachment: Attachment) => void;
  onDelete?: (attachmentId: string) => void;
  canDelete?: boolean;
  className?: string;
}

/**
 * Get icon component based on mime type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) {
    return FileText;
  }
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) {
    return FileArchive;
  }
  return File;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function AttachmentsList({
  attachments,
  onDownload,
  onDelete,
  canDelete = true,
  className,
}: AttachmentsListProps) {
  if (attachments.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground text-center py-4", className)}>
        No attachments yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {attachments.map((attachment) => {
        const Icon = getFileIcon(attachment.mime_type);

        return (
          <div
            key={attachment.id}
            className="flex items-center gap-3 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" title={attachment.filename}>
                {attachment.filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(attachment.file_size)} • {formatDate(attachment.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onDownload && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDownload(attachment)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(attachment.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact attachment count badge
 */
export function AttachmentsBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
      title={`${count} attachment${count === 1 ? "" : "s"}`}
    >
      <File className="h-3 w-3" />
      <span>{count}</span>
    </div>
  );
}
