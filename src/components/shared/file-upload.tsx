"use client";

import { useCallback, useState } from "react";
import { Upload, File as FileIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllowedFileTypesDescription } from "@/lib/validation/file-types";

interface FileUploadProps {
  onUpload: (file: File) => Promise<unknown>;
  uploading?: boolean;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onUpload,
  uploading = false,
  accept,
  maxSizeMB = 10,
  className,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file size
      const maxSize = maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File too large. Maximum size is ${maxSizeMB}MB`);
        return;
      }

      setSelectedFile(file);
      try {
        await onUpload(file);
      } finally {
        setSelectedFile(null);
      }
    },
    [onUpload, maxSizeMB]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || uploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, uploading, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
        isDragging && "border-primary bg-primary/5",
        !isDragging && "border-muted-foreground/25 hover:border-muted-foreground/50",
        (disabled || uploading) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Uploading {selectedFile?.name}...
          </p>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Drag and drop a file here, or{" "}
              <label
                htmlFor="file-upload"
                className={cn(
                  "font-medium text-primary cursor-pointer hover:underline",
                  disabled && "cursor-not-allowed"
                )}
              >
                browse
              </label>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max file size: {maxSizeMB}MB
            </p>
            {!accept && (
              <p className="text-xs text-muted-foreground mt-1">
                Allowed: {getAllowedFileTypesDescription()}
              </p>
            )}
          </div>
        </>
      )}
      <input
        id="file-upload"
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled || uploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

/**
 * Compact inline file upload button
 */
interface FileUploadButtonProps {
  onUpload: (file: File) => Promise<unknown>;
  uploading?: boolean;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function FileUploadButton({
  onUpload,
  uploading = false,
  accept,
  maxSizeMB = 10,
  className,
  disabled = false,
  children,
}: FileUploadButtonProps) {
  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`File too large. Maximum size is ${maxSizeMB}MB`);
          return;
        }
        await onUpload(file);
      }
      e.target.value = "";
    },
    [onUpload, maxSizeMB]
  );

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer",
        (disabled || uploading) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        children || (
          <>
            <Upload className="h-4 w-4" />
            <span>Upload file</span>
          </>
        )
      )}
      <input
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled || uploading}
        className="sr-only"
      />
    </label>
  );
}
