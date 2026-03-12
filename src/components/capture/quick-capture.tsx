"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCaptureMutations } from "@/hooks/use-captures";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { CaptureType } from "@/types/database";

interface QuickCaptureProps {
  /** Called after a capture is saved (to close popover etc.) */
  onCaptured?: () => void;
}

export function QuickCapture({ onCaptured }: QuickCaptureProps) {
  const [text, setText] = useState("");
  const [captureType, setCaptureType] = useState<CaptureType>("thought");
  const { activeWorkspace } = useWorkspaceContext();
  const { createCapture, loading } = useCaptureMutations();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeWorkspace) return;

    await createCapture({
      workspace_id: activeWorkspace.id,
      title: text.trim(),
      capture_type: captureType,
      occurred_at: new Date().toISOString(),
    });

    setText("");
    onCaptured?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Select
        value={captureType}
        onValueChange={(v) => setCaptureType(v as CaptureType)}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="thought">Thought</SelectItem>
          <SelectItem value="meeting_note">Meeting</SelectItem>
          <SelectItem value="document">Document</SelectItem>
          <SelectItem value="media">Media</SelectItem>
        </SelectContent>
      </Select>

      <Input
        ref={inputRef}
        placeholder="Quick capture..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 h-8 text-sm"
        maxLength={200}
      />

      <Button
        type="submit"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={!text.trim() || loading}
      >
        <Send className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
