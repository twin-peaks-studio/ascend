/**
 * Supabase Database Types
 *
 * These types define the structure of our database tables.
 * They provide TypeScript autocompletion and type safety for all database operations.
 *
 * IMPORTANT: If you modify the database schema, regenerate these types using:
 * npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
 *
 * For now, we define them manually to match our schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: "active" | "completed" | "archived";
          priority: "low" | "medium" | "high" | "urgent";
          color: string;
          lead_id: string | null;
          due_date: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: "active" | "completed" | "archived";
          priority?: "low" | "medium" | "high" | "urgent";
          color?: string;
          lead_id?: string | null;
          due_date?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: "active" | "completed" | "archived";
          priority?: "low" | "medium" | "high" | "urgent";
          color?: string;
          lead_id?: string | null;
          due_date?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          status: "todo" | "in-progress" | "done";
          priority: "low" | "medium" | "high" | "urgent";
          due_date: string | null;
          assignee_id: string | null;
          is_duplicate: boolean;
          is_archived: boolean;
          position: number;
          source_type: "manual" | "ai_extraction";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          status?: "todo" | "in-progress" | "done";
          priority?: "low" | "medium" | "high" | "urgent";
          due_date?: string | null;
          assignee_id?: string | null;
          is_duplicate?: boolean;
          is_archived?: boolean;
          position?: number;
          source_type?: "manual" | "ai_extraction";
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          status?: "todo" | "in-progress" | "done";
          priority?: "low" | "medium" | "high" | "urgent";
          due_date?: string | null;
          assignee_id?: string | null;
          is_duplicate?: boolean;
          is_archived?: boolean;
          position?: number;
          source_type?: "manual" | "ai_extraction";
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          task_id: string | null;
          project_id: string | null;
          author_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          project_id?: string | null;
          author_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          project_id?: string | null;
          author_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      project_documents: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          url: string | null;
          content: string | null;
          type: "link" | "document" | "note";
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          url?: string | null;
          content?: string | null;
          type?: "link" | "document" | "note";
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          url?: string | null;
          content?: string | null;
          type?: "link" | "document" | "note";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          entity_type: "task" | "project";
          entity_id: string;
          filename: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: "task" | "project";
          entity_id: string;
          filename: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: "task" | "project";
          entity_id?: string;
          filename?: string;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: "owner" | "member";
          invited_by: string;
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: "owner" | "member";
          invited_by: string;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: "owner" | "member";
          invited_by?: string;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      notes: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          content: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          content?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          content?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      note_tasks: {
        Row: {
          id: string;
          note_id: string;
          task_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          task_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          task_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_tasks_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_tasks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          type: string;
          comment_id: string | null;
          task_id: string | null;
          project_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          type?: string;
          comment_id?: string | null;
          task_id?: string | null;
          project_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string;
          type?: string;
          comment_id?: string | null;
          task_id?: string | null;
          project_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      time_entries: {
        Row: {
          id: string;
          entity_type: "task" | "note" | "project";
          entity_id: string;
          user_id: string;
          start_time: string;
          end_time: string | null;
          duration: number | null;
          timezone: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_type: "task" | "note" | "project";
          entity_id: string;
          user_id: string;
          start_time: string;
          end_time?: string | null;
          duration?: number | null;
          timezone: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: "task" | "note" | "project";
          entity_id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string | null;
          duration?: number | null;
          timezone?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      activity_log: {
        Row: {
          id: string;
          project_id: string;
          task_id: string | null;
          actor_id: string | null;
          action: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id?: string | null;
          actor_id?: string | null;
          action: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          actor_id?: string | null;
          action?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Helper types for easier usage
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenient aliases
export type Project = Tables<"projects">;
export type ProjectInsert = InsertTables<"projects">;
export type ProjectUpdate = UpdateTables<"projects">;

export type Task = Tables<"tasks">;
export type TaskInsert = InsertTables<"tasks">;
export type TaskUpdate = UpdateTables<"tasks">;

export type ProjectDocument = Tables<"project_documents">;
export type ProjectDocumentInsert = InsertTables<"project_documents">;
export type ProjectDocumentUpdate = UpdateTables<"project_documents">;

export type Comment = Tables<"comments">;
export type CommentInsert = InsertTables<"comments">;
export type CommentUpdate = UpdateTables<"comments">;

export type Profile = Tables<"profiles">;
export type ProfileInsert = InsertTables<"profiles">;
export type ProfileUpdate = UpdateTables<"profiles">;

export type Attachment = Tables<"attachments">;
export type AttachmentInsert = InsertTables<"attachments">;
export type AttachmentUpdate = UpdateTables<"attachments">;

export type ProjectMember = Tables<"project_members">;
export type ProjectMemberInsert = InsertTables<"project_members">;
export type ProjectMemberUpdate = UpdateTables<"project_members">;

export type Note = Tables<"notes">;
export type NoteInsert = InsertTables<"notes">;
export type NoteUpdate = UpdateTables<"notes">;

export type NoteTask = Tables<"note_tasks">;
export type NoteTaskInsert = InsertTables<"note_tasks">;
export type NoteTaskUpdate = UpdateTables<"note_tasks">;

export type Notification = Tables<"notifications">;
export type NotificationInsert = InsertTables<"notifications">;
export type NotificationUpdate = UpdateTables<"notifications">;

export type TimeEntry = Tables<"time_entries">;
export type TimeEntryInsert = InsertTables<"time_entries">;
export type TimeEntryUpdate = UpdateTables<"time_entries">;

export type ActivityLog = Tables<"activity_log">;
export type ActivityLogInsert = InsertTables<"activity_log">;
export type ActivityLogUpdate = UpdateTables<"activity_log">;

// Entity type for polymorphic relationships (time entries, etc.)
export type TimeTrackingEntityType = "task" | "note" | "project";
