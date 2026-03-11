"use client";

import { useState, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Trash2,
  Download,
  FileText,
  FileArchive,
  FileVideo,
  File,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAttachments, formatFileSize } from "@/hooks/use-attachments";
import type { ExtractionOptions } from "@/hooks/use-attachments";
import { validateFiles } from "@/lib/validation/file-types";
import type { Attachment } from "@/types";

const MAX_NOTE_ATTACHMENTS = 20;

const EXTRACTABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

function isExtractable(mimeType: string): boolean {
  return EXTRACTABLE_MIME_TYPES.has(mimeType);
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("text")) {
    return <FileText className="h-8 w-8 text-muted-foreground" />;
  }
  if (mimeType.includes("zip") || mimeType.includes("archive")) {
    return <FileArchive className="h-8 w-8 text-muted-foreground" />;
  }
  if (mimeType.startsWith("video/")) {
    return <FileVideo className="h-8 w-8 text-muted-foreground" />;
  }
  return <File className="h-8 w-8 text-muted-foreground" />;
}

// ─── DropZone ───────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  attachmentCount: number;
}

function DropZone({ onFilesSelected, disabled, attachmentCount }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (rawFiles: FileList | null) => {
      if (!rawFiles || rawFiles.length === 0) return;

      const files = Array.from(rawFiles);
      const { valid, rejected } = validateFiles(files);

      rejected.forEach(({ file, reason }) => {
        toast.error(`${file.name}: ${reason}`);
      });

      if (valid.length === 0) return;

      const available = MAX_NOTE_ATTACHMENTS - attachmentCount;
      if (valid.length > available) {
        toast.warning(
          `Only ${available} more file${available === 1 ? "" : "s"} can be added (${MAX_NOTE_ATTACHMENTS} max). Some files were skipped.`
        );
        onFilesSelected(valid.slice(0, available));
      } else {
        onFilesSelected(valid);
      }
    },
    [attachmentCount, onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [processFiles]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2
        transition-colors cursor-pointer text-center
        ${isDragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Images, PDFs, documents, ZIP, video · Max 10 MB · Up to {MAX_NOTE_ATTACHMENTS} files
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}

// ─── UploadOptionsDialog ─────────────────────────────────────────────────────

interface PendingFileOptions {
  file: File;
  extractText: boolean;
  appendToNote: boolean;
}

interface UploadOptionsDialogProps {
  open: boolean;
  pendingFiles: File[];
  onConfirm: (options: PendingFileOptions[]) => void;
  onCancel: () => void;
}

function UploadOptionsDialog({
  open,
  pendingFiles,
  onConfirm,
  onCancel,
}: UploadOptionsDialogProps) {
  const [fileOptions, setFileOptions] = useState<PendingFileOptions[]>(() =>
    pendingFiles.map((file) => ({
      file,
      extractText: false,
      appendToNote: false,
    }))
  );

  // Sync fileOptions when pendingFiles changes
  const prevPendingRef = useRef<File[]>([]);
  if (prevPendingRef.current !== pendingFiles) {
    prevPendingRef.current = pendingFiles;
    const next = pendingFiles.map((file) => ({
      file,
      extractText: false,
      appendToNote: false,
    }));
    // Only update if different to avoid infinite render
    if (JSON.stringify(next.map((o) => o.file.name)) !== JSON.stringify(fileOptions.map((o) => o.file.name))) {
      // This is intentionally a sync setState during render to handle prop changes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileOptions(next);
    }
  }

  const updateOption = (
    index: number,
    key: keyof Omit<PendingFileOptions, "file">,
    value: boolean
  ) => {
    setFileOptions((prev) =>
      prev.map((opt, i) =>
        i === index
          ? {
              ...opt,
              [key]: value,
              // Reset appendToNote if extractText is unchecked
              ...(key === "extractText" && !value ? { appendToNote: false } : {}),
            }
          : opt
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {pendingFiles.length === 1 ? "File" : `${pendingFiles.length} Files`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {fileOptions.map((opt, index) => (
            <div key={opt.file.name + index} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate flex-1">{opt.file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFileSize(opt.file.size)}
                </span>
              </div>

              {isExtractable(opt.file.type) && (
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={opt.extractText}
                      onChange={(e) => updateOption(index, "extractText", e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">Extract text from this file using AI</span>
                  </label>

                  {opt.extractText && (
                    <div className="pl-6 space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`append-${index}`}
                          checked={opt.appendToNote}
                          onChange={() => updateOption(index, "appendToNote", true)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-sm">Append extracted text to note body</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`append-${index}`}
                          checked={!opt.appendToNote}
                          onChange={() => updateOption(index, "appendToNote", false)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-sm">Store as text on attachment</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(fileOptions)}>
            Upload {pendingFiles.length === 1 ? "File" : `${pendingFiles.length} Files`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AttachmentThumbnail ─────────────────────────────────────────────────────

interface AttachmentThumbnailProps {
  attachment: Attachment;
  onDelete: (id: string) => void;
  onDownload: (attachment: Attachment) => void;
  getFileUrl: (attachment: Attachment) => string;
  onViewExtractedText: (attachment: Attachment) => void;
}

function AttachmentThumbnail({
  attachment,
  onDelete,
  onDownload,
  getFileUrl,
  onViewExtractedText,
}: AttachmentThumbnailProps) {
  const isImage = isImageMime(attachment.mime_type);
  const hasStoredExtractedText =
    attachment.extracted_text && !attachment.append_to_note;

  return (
    <div className="group relative aspect-square rounded-lg border bg-muted overflow-hidden">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getFileUrl(attachment)}
          alt={attachment.filename}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          <FileTypeIcon mimeType={attachment.mime_type} />
          <p className="text-xs text-muted-foreground text-center line-clamp-2 leading-tight">
            {attachment.filename}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {formatFileSize(attachment.file_size)}
          </p>
        </div>
      )}

      {/* Extracted text badge */}
      {hasStoredExtractedText && (
        <button
          onClick={() => onViewExtractedText(attachment)}
          title="View extracted text"
          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors"
        >
          <FileText className="h-3 w-3" />
        </button>
      )}

      {/* Hover overlay with actions */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
        <button
          onClick={() => onDownload(attachment)}
          title="Download"
          className="h-7 w-7 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(attachment.id)}
          title="Delete"
          className="h-7 w-7 rounded-md bg-white/20 hover:bg-destructive/80 text-white flex items-center justify-center transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── ExtractedTextPanel ──────────────────────────────────────────────────────

interface ExtractedTextPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: Attachment | null;
}

function ExtractedTextPanel({ open, onOpenChange, attachment }: ExtractedTextPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!attachment?.extracted_text) return;
    await navigator.clipboard.writeText(attachment.extracted_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [attachment]);

  if (!attachment) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="truncate pr-8">{attachment.filename}</SheetTitle>
        </SheetHeader>

        <div className="flex items-center justify-between mt-2 mb-3">
          <p className="text-xs text-muted-foreground">Extracted text</p>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border bg-muted/40 p-3">
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/90 leading-relaxed">
            {attachment.extracted_text || "No text extracted."}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── NoteAttachmentsSection (main export) ────────────────────────────────────

interface NoteAttachmentsSectionProps {
  noteId: string;
  content: string;
  onContentChange: (newContent: string) => void;
  onSaveContent: (noteId: string, newContent: string) => Promise<void>;
}

export function NoteAttachmentsSection({
  noteId,
  content,
  onContentChange,
  onSaveContent,
}: NoteAttachmentsSectionProps) {
  const {
    attachments,
    uploading,
    uploadWithExtraction,
    deleteAttachment,
    downloadFile,
    getFileUrl,
  } = useAttachments("note", noteId);

  const [showAttachments, setShowAttachments] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [textPanelAttachment, setTextPanelAttachment] = useState<Attachment | null>(null);

  const handleFilesSelected = useCallback((files: File[]) => {
    setPendingFiles(files);
  }, []);

  const handleUploadConfirm = useCallback(
    async (options: Array<{ file: File; extractText: boolean; appendToNote: boolean }>) => {
      setPendingFiles([]);

      for (const { file, extractText, appendToNote } of options) {
        const extractionOptions: ExtractionOptions = {
          extractText,
          appendToNote,
          onAppendToNote: async (text: string, filename: string) => {
            const separator = `<hr><p><strong>Extracted from ${filename}:</strong></p>`;
            const newContent = content + separator + `<p>${text.replace(/\n/g, "</p><p>")}</p>`;
            onContentChange(newContent);
            await onSaveContent(noteId, newContent);
          },
        };
        await uploadWithExtraction(file, extractionOptions);
      }
    },
    [uploadWithExtraction, content, onContentChange, onSaveContent, noteId]
  );

  return (
    <div className="border-t border-border/40 pt-6 mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowAttachments(!showAttachments)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
        >
          {showAttachments ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs font-normal">({attachments.length})</span>
          )}
        </button>
        <span className="text-xs text-muted-foreground">
          {attachments.length}/{MAX_NOTE_ATTACHMENTS}
        </span>
      </div>

      {showAttachments && (
        <>
          {/* Drop zone — hidden when at cap */}
          {attachments.length < MAX_NOTE_ATTACHMENTS && (
            <DropZone
              onFilesSelected={handleFilesSelected}
              disabled={uploading}
              attachmentCount={attachments.length}
            />
          )}

          {/* Thumbnail grid */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
              {attachments.map((attachment) => (
                <AttachmentThumbnail
                  key={attachment.id}
                  attachment={attachment}
                  onDelete={deleteAttachment}
                  onDownload={downloadFile}
                  getFileUrl={getFileUrl}
                  onViewExtractedText={setTextPanelAttachment}
                />
              ))}
            </div>
          )}

          {attachments.length === 0 && !uploading && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No attachments yet
            </p>
          )}
        </>
      )}

      {/* Upload options dialog */}
      {pendingFiles.length > 0 && (
        <UploadOptionsDialog
          open={pendingFiles.length > 0}
          pendingFiles={pendingFiles}
          onConfirm={handleUploadConfirm}
          onCancel={() => setPendingFiles([])}
        />
      )}

      {/* Extracted text panel */}
      <ExtractedTextPanel
        open={textPanelAttachment !== null}
        onOpenChange={(open) => {
          if (!open) setTextPanelAttachment(null);
        }}
        attachment={textPanelAttachment}
      />
    </div>
  );
}
