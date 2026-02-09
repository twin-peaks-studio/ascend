"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Indent,
  Outdent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markdownToHtml, isHtmlContent } from "@/lib/description-utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Minimum height in pixels for the editor area (default 80) */
  minHeight?: number;
  /** Called on keydown events inside the editor (e.g. for Escape handling) */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
  disabled = false,
  autoFocus = false,
  minHeight = 80,
  onKeyDown,
}: RichTextEditorProps) {
  // Convert markdown content to HTML for initial load
  const initialContent = value ? (isHtmlContent(value) ? value : markdownToHtml(value)) : "";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: { class: "list-disc pl-4 space-y-1" },
        },
        orderedList: {
          HTMLAttributes: { class: "list-decimal pl-4 space-y-1" },
        },
        paragraph: {
          HTMLAttributes: { class: "mb-2 last:mb-0" },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline hover:no-underline" },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !disabled,
    autofocus: autoFocus,
    immediatelyRender: false, // Prevent SSR hydration mismatch
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync external value changes (e.g. when parent resets the value)
  useEffect(() => {
    if (!editor) return;
    const html = isHtmlContent(value) ? value : markdownToHtml(value);
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html);
    }
  }, [editor, value]);

  // Expose keyboard events to parent
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyDown?.(e);
    },
    [onKeyDown]
  );

  if (!editor) return null;

  const addLink = () => {
    // eslint-disable-next-line no-alert
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const toolbarButtons = [
    {
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold"),
      icon: Bold,
      label: "Bold",
    },
    {
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic"),
      icon: Italic,
      label: "Italic",
    },
    {
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive("bulletList"),
      icon: List,
      label: "Bullet list",
    },
    {
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive("orderedList"),
      icon: ListOrdered,
      label: "Numbered list",
    },
    {
      action: () => editor.chain().focus().sinkListItem("listItem").run(),
      isActive: false,
      icon: Indent,
      label: "Increase indent",
      disabled: !editor.can().sinkListItem("listItem"),
    },
    {
      action: () => editor.chain().focus().liftListItem("listItem").run(),
      isActive: false,
      icon: Outdent,
      label: "Decrease indent",
      disabled: !editor.can().liftListItem("listItem"),
    },
    {
      action: addLink,
      isActive: editor.isActive("link"),
      icon: LinkIcon,
      label: "Link",
    },
  ];

  return (
    <div className={cn("space-y-1", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1 border rounded-md bg-muted/30 w-fit flex-wrap">
        {toolbarButtons.map(
          ({ action, isActive, icon: Icon, label, disabled: btnDisabled }) => (
            <Button
              key={label}
              type="button"
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 touch-manipulation"
              onClick={action}
              disabled={disabled || btnDisabled}
              title={label}
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        )}
      </div>

      {/* Editor */}
      { }
      <div
        onKeyDown={handleKeyDown}
        className={cn(
          "border rounded-md p-3 bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ minHeight }}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
            "[&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:min-h-0",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
          )}
        />
      </div>
    </div>
  );
}
