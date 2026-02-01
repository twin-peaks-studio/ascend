"use client";

import { useRef, useCallback } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Indent,
  Outdent,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

type FormatAction =
  | "bold"
  | "italic"
  | "bullet"
  | "numbered"
  | "link"
  | "indent"
  | "outdent";

// Helper to get the current line info
function getLineInfo(text: string, cursorPos: number) {
  const lineStart = text.lastIndexOf("\n", cursorPos - 1) + 1;
  const lineEnd = text.indexOf("\n", cursorPos);
  const currentLine = text.substring(
    lineStart,
    lineEnd === -1 ? text.length : lineEnd
  );
  const posInLine = cursorPos - lineStart;
  return { lineStart, lineEnd, currentLine, posInLine };
}

// Check if line starts with a list marker and return info
function getListInfo(line: string) {
  // Bullet list: "- ", "* ", "+ "
  const bulletMatch = line.match(/^(\s*)([-*+])\s/);
  if (bulletMatch) {
    return {
      type: "bullet" as const,
      indent: bulletMatch[1],
      marker: bulletMatch[2],
      prefix: bulletMatch[0],
      content: line.substring(bulletMatch[0].length),
    };
  }

  // Numbered list: "1. ", "2. ", etc.
  const numberedMatch = line.match(/^(\s*)(\d+)\.\s/);
  if (numberedMatch) {
    return {
      type: "numbered" as const,
      indent: numberedMatch[1],
      number: parseInt(numberedMatch[2], 10),
      prefix: numberedMatch[0],
      content: line.substring(numberedMatch[0].length),
    };
  }

  return null;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  className,
  disabled = false,
  autoFocus = false,
  onKeyDown,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper for indent/outdent operations
  const handleIndent = useCallback(
    (direction: "indent" | "outdent") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const { lineStart, currentLine } = getLineInfo(value, cursorPos);
      const listInfo = getListInfo(currentLine);

      if (listInfo) {
        if (direction === "outdent") {
          // Outdent: remove 2 spaces from the beginning if present
          if (listInfo.indent.length >= 2) {
            const newText =
              value.substring(0, lineStart) +
              currentLine.substring(2) +
              value.substring(lineStart + currentLine.length);
            onChange(newText);

            const newCursorPos = Math.max(lineStart, cursorPos - 2);
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            });
          }
        } else {
          // Indent: add 2 spaces at the beginning
          const newText =
            value.substring(0, lineStart) +
            "  " +
            currentLine +
            value.substring(lineStart + currentLine.length);
          onChange(newText);

          const newCursorPos = cursorPos + 2;
          requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          });
        }
      } else {
        // Not in a list - just add/remove indent for regular text
        if (direction === "outdent") {
          // Remove leading spaces (up to 2)
          const leadingSpaces = currentLine.match(/^(\s*)/)?.[1] || "";
          const spacesToRemove = Math.min(2, leadingSpaces.length);
          if (spacesToRemove > 0) {
            const newText =
              value.substring(0, lineStart) +
              currentLine.substring(spacesToRemove) +
              value.substring(lineStart + currentLine.length);
            onChange(newText);

            const newCursorPos = Math.max(lineStart, cursorPos - spacesToRemove);
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            });
          }
        } else {
          // Add 2 spaces at line start
          const newText =
            value.substring(0, lineStart) +
            "  " +
            currentLine +
            value.substring(lineStart + currentLine.length);
          onChange(newText);

          const newCursorPos = cursorPos + 2;
          requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          });
        }
      }
    },
    [value, onChange]
  );

  const insertFormat = useCallback(
    (action: FormatAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Handle indent/outdent separately
      if (action === "indent" || action === "outdent") {
        handleIndent(action);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      let newText = "";
      let cursorOffset = 0;

      switch (action) {
        case "bold":
          if (selectedText) {
            newText =
              value.substring(0, start) +
              `**${selectedText}**` +
              value.substring(end);
            cursorOffset = end + 4;
          } else {
            newText =
              value.substring(0, start) + "**text**" + value.substring(end);
            cursorOffset = start + 2;
          }
          break;

        case "italic":
          if (selectedText) {
            newText =
              value.substring(0, start) +
              `*${selectedText}*` +
              value.substring(end);
            cursorOffset = end + 2;
          } else {
            newText =
              value.substring(0, start) + "*text*" + value.substring(end);
            cursorOffset = start + 1;
          }
          break;

        case "bullet":
          if (selectedText) {
            const lines = selectedText.split("\n");
            const formatted = lines.map((line) => `- ${line}`).join("\n");
            newText =
              value.substring(0, start) + formatted + value.substring(end);
            cursorOffset = start + formatted.length;
          } else {
            const prefix = start === 0 || value[start - 1] === "\n" ? "" : "\n";
            newText =
              value.substring(0, start) + `${prefix}- ` + value.substring(end);
            cursorOffset = start + prefix.length + 2;
          }
          break;

        case "numbered":
          if (selectedText) {
            const lines = selectedText.split("\n");
            const formatted = lines
              .map((line, i) => `${i + 1}. ${line}`)
              .join("\n");
            newText =
              value.substring(0, start) + formatted + value.substring(end);
            cursorOffset = start + formatted.length;
          } else {
            const prefix = start === 0 || value[start - 1] === "\n" ? "" : "\n";
            newText =
              value.substring(0, start) +
              `${prefix}1. ` +
              value.substring(end);
            cursorOffset = start + prefix.length + 3;
          }
          break;

        case "link":
          if (selectedText) {
            newText =
              value.substring(0, start) +
              `[${selectedText}](url)` +
              value.substring(end);
            cursorOffset = end + 3;
          } else {
            newText =
              value.substring(0, start) + "[text](url)" + value.substring(end);
            cursorOffset = start + 1;
          }
          break;
      }

      onChange(newText);

      // Restore focus and set cursor position
      requestAnimationFrame(() => {
        textarea.focus();
        if (action === "bold" && !selectedText) {
          textarea.setSelectionRange(cursorOffset, cursorOffset + 4);
        } else if (action === "italic" && !selectedText) {
          textarea.setSelectionRange(cursorOffset, cursorOffset + 4);
        } else if (action === "link" && !selectedText) {
          textarea.setSelectionRange(cursorOffset, cursorOffset + 4);
        } else {
          textarea.setSelectionRange(cursorOffset, cursorOffset);
        }
      });
    },
    [value, onChange, handleIndent]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Handle keyboard shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            insertFormat("bold");
            return;
          case "i":
            e.preventDefault();
            insertFormat("italic");
            return;
          case "k":
            e.preventDefault();
            insertFormat("link");
            return;
        }
      }

      // Handle Enter key for list continuation
      if (e.key === "Enter" && !e.shiftKey) {
        const cursorPos = textarea.selectionStart;
        const { lineStart, currentLine } = getLineInfo(value, cursorPos);
        const listInfo = getListInfo(currentLine);

        if (listInfo) {
          e.preventDefault();

          // If the list item is empty (just the marker), end the list
          if (!listInfo.content.trim()) {
            // Remove the empty list marker and just add a newline
            const newText =
              value.substring(0, lineStart) +
              "\n" +
              value.substring(lineStart + listInfo.prefix.length);
            onChange(newText);

            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(lineStart + 1, lineStart + 1);
            });
            return;
          }

          // Continue the list on the next line
          let newMarker: string;
          if (listInfo.type === "bullet") {
            newMarker = `${listInfo.indent}${listInfo.marker} `;
          } else {
            newMarker = `${listInfo.indent}${listInfo.number + 1}. `;
          }

          const newText =
            value.substring(0, cursorPos) +
            "\n" +
            newMarker +
            value.substring(cursorPos);
          onChange(newText);

          const newCursorPos = cursorPos + 1 + newMarker.length;
          requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          });
          return;
        }
      }

      // Handle Tab key for indentation in lists
      if (e.key === "Tab") {
        const cursorPos = textarea.selectionStart;
        const { currentLine } = getLineInfo(value, cursorPos);
        const listInfo = getListInfo(currentLine);

        if (listInfo) {
          e.preventDefault();
          handleIndent(e.shiftKey ? "outdent" : "indent");
          return;
        }
      }

      // Pass through to parent handler
      onKeyDown?.(e);
    },
    [value, onChange, insertFormat, handleIndent, onKeyDown]
  );

  // Handle input to auto-convert list markers
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      const newValue = textarea.value;
      const cursorPos = textarea.selectionStart;

      // Check if user just typed a space after a list marker at line start
      const { currentLine, posInLine } = getLineInfo(newValue, cursorPos);

      // Auto-convert "* " or "- " or "+ " at line start to bullet
      // This happens when user types: "* " (asterisk then space)
      if (posInLine === 2) {
        const marker = currentLine.substring(0, 2);
        if (marker === "* " || marker === "- " || marker === "+ ") {
          // Already in correct format, just update
          onChange(newValue);
          return;
        }
      }

      // Auto-convert "1. " at line start to numbered list
      if (posInLine >= 3) {
        const match = currentLine.match(/^(\d+)\.\s$/);
        if (match && posInLine === match[0].length) {
          // Already in correct format, just update
          onChange(newValue);
          return;
        }
      }

      onChange(newValue);
    },
    [onChange]
  );

  const toolbarButtons = [
    { action: "bold" as const, icon: Bold, label: "Bold" },
    { action: "italic" as const, icon: Italic, label: "Italic" },
    { action: "bullet" as const, icon: List, label: "Bullet list" },
    { action: "numbered" as const, icon: ListOrdered, label: "Numbered list" },
    { action: "outdent" as const, icon: Outdent, label: "Decrease indent" },
    { action: "indent" as const, icon: Indent, label: "Increase indent" },
    { action: "link" as const, icon: Link, label: "Link" },
  ];

  return (
    <div className={cn("space-y-1", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1 border rounded-md bg-muted/30 w-fit flex-wrap">
        {toolbarButtons.map(({ action, icon: Icon, label }) => (
          <Button
            key={action}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 touch-manipulation"
            onClick={() => insertFormat(action)}
            disabled={disabled}
            title={label}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        className="resize-none"
      />
    </div>
  );
}
