"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { isHtmlContent } from "@/lib/description-utils";

interface MarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
  placeholder?: string;
}

export function MarkdownRenderer({
  content,
  className,
  placeholder = "No description",
}: MarkdownRendererProps) {
  if (!content?.trim()) {
    return (
      <p className={cn("text-muted-foreground", className)}>{placeholder}</p>
    );
  }

  // If content is HTML (from the rich-text editor), render it directly
  if (isHtmlContent(content)) {
    return (
      <div
        className={cn("prose-description", className)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Otherwise, render as markdown (legacy content)
  return (
    <div className={cn("prose-description", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Prevent XSS by not allowing raw HTML
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto mb-2">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
