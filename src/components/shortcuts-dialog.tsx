"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  {
    keys: ["Cmd", "K"],
    description: "Quick create task",
  },
  {
    keys: ["Cmd", "P"],
    description: "Quick create project",
  },
  {
    keys: ["Cmd", "/"],
    description: "Show keyboard shortcuts",
  },
  {
    keys: ["?"],
    description: "Show keyboard shortcuts",
  },
  {
    keys: ["Esc"],
    description: "Close dialog / Cancel",
  },
];

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <kbd
                    key={keyIndex}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 font-mono text-xs font-medium"
                  >
                    {key === "Cmd" ? "⌘" : key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          On Windows/Linux, use Ctrl instead of Cmd
        </p>
      </DialogContent>
    </Dialog>
  );
}
