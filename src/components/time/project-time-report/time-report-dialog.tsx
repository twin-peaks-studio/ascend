"use client";

/**
 * Time Report Dialog
 *
 * Main modal for viewing project time tracking report.
 * Provides two views: By Day and By Task.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Loader2 } from "lucide-react";
import { useProjectTimeReport } from "@/hooks/use-project-time-report";
import { formatDuration } from "@/hooks/use-time-tracking";
import { TimeReportByDay } from "./time-report-by-day";
import { TimeReportByTask } from "./time-report-by-task";

interface TimeReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  onTaskClick?: (taskId: string) => void;
}

export function TimeReportDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onTaskClick,
}: TimeReportDialogProps) {
  const { report, loading, error } = useProjectTimeReport(projectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Report
          </DialogTitle>
          <DialogDescription className="sr-only">
            View time tracked on tasks in this project, grouped by day or by task.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">
            Failed to load time report
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total time */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">Total Time</span>
              <span className="text-lg font-semibold font-mono tabular-nums">
                {report ? formatDuration(report.totalSeconds) : "0:00"}
              </span>
            </div>

            {/* Tabs for different views */}
            <Tabs defaultValue="by-day" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="by-day" className="flex-1">
                  By Day
                </TabsTrigger>
                <TabsTrigger value="by-task" className="flex-1">
                  By Task
                </TabsTrigger>
              </TabsList>

              <TabsContent value="by-day" className="mt-4">
                <TimeReportByDay days={report?.byDay || []} onTaskClick={onTaskClick} />
              </TabsContent>

              <TabsContent value="by-task" className="mt-4">
                <TimeReportByTask tasks={report?.tasksByTime || []} onTaskClick={onTaskClick} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
