/**
 * AI Task Extraction Types
 *
 * Designed for extensibility to support extraction from:
 * - Notes (current)
 * - Task descriptions (future)
 * - Project descriptions (future)
 * - Comments (future)
 */

// Source types for extraction - extensible for future sources
export type ExtractionSourceType =
  | "note"
  | "task_description"
  | "project_description";

// Task source types for database
export type TaskSourceType = "manual" | "ai_extraction";

// Input for extraction API
export interface ExtractionSource {
  type: ExtractionSourceType;
  id: string;
  content: string;
  projectId?: string;
  projectTitle?: string;
}

// Raw task from AI response (before client processing)
export interface RawExtractedTask {
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  suggestedDueDate: string | null;
  confidence: number;
}

// Client-side extracted task with UI state
export interface ExtractedTask extends RawExtractedTask {
  id: string; // Client-generated UUID for list key
  selected: boolean; // User selection state
}

// API request body
export interface ExtractTasksRequest {
  sourceType: ExtractionSourceType;
  sourceId: string;
  content: string;
  projectId?: string;
  projectTitle?: string;
  existingTaskTitles?: string[];
}

// Successful API response
export interface ExtractTasksSuccessResponse {
  success: true;
  tasks: RawExtractedTask[];
  model: string;
  extractedAt: string;
}

// Error types for extraction
export type ExtractionErrorType =
  | "timeout"
  | "rate_limit"
  | "invalid_response"
  | "api_error"
  | "auth_error"
  | "empty_content";

// Error response from API
export interface ExtractionError {
  type: ExtractionErrorType;
  message: string;
  retryAfter?: number;
  status?: number;
}

export interface ExtractTasksErrorResponse {
  success: false;
  error: ExtractionError;
}

// Combined API response type
export type ExtractTasksResponse =
  | ExtractTasksSuccessResponse
  | ExtractTasksErrorResponse;

// Hook state
export type ExtractionStatus =
  | "idle"
  | "extracting"
  | "reviewing"
  | "creating"
  | "error"
  | "success";

export interface UseTaskExtractionState {
  status: ExtractionStatus;
  extractedTasks: ExtractedTask[];
  error: ExtractionError | null;
  createdCount: number;
  sourceNoteId: string | null;
  sourceProjectId: string | null;
}

// Hook actions
export interface UseTaskExtractionActions {
  extractFromNote: (
    noteId: string,
    content: string,
    projectId: string,
    projectTitle?: string
  ) => Promise<void>;
  updateTask: (id: string, updates: Partial<ExtractedTask>) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  createSelectedTasks: () => Promise<void>;
  reset: () => void;
}

// Combined hook return type
export type UseTaskExtractionReturn = UseTaskExtractionState &
  UseTaskExtractionActions;
