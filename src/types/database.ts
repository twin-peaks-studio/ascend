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
          workspace_id: string;
          title: string;
          description: string | null;
          status: "active" | "completed" | "archived";
          priority: "low" | "medium" | "high" | "urgent";
          color: string;
          lead_id: string | null;
          due_date: string | null;
          entity_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          description?: string | null;
          status?: "active" | "completed" | "archived";
          priority?: "low" | "medium" | "high" | "urgent";
          color?: string;
          lead_id?: string | null;
          due_date?: string | null;
          entity_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          description?: string | null;
          status?: "active" | "completed" | "archived";
          priority?: "low" | "medium" | "high" | "urgent";
          color?: string;
          lead_id?: string | null;
          due_date?: string | null;
          entity_id?: string | null;
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
          },
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
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
          section_id: string | null;
          section_position: number;
          source_type: "manual" | "ai_extraction" | "feedback_form";
          feedback_submission_id: string | null;
          initiative_entity_id: string | null;
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
          section_id?: string | null;
          section_position?: number;
          source_type?: "manual" | "ai_extraction" | "feedback_form";
          feedback_submission_id?: string | null;
          initiative_entity_id?: string | null;
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
          section_id?: string | null;
          section_position?: number;
          source_type?: "manual" | "ai_extraction" | "feedback_form";
          feedback_submission_id?: string | null;
          initiative_entity_id?: string | null;
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
          },
          {
            foreignKeyName: "tasks_initiative_entity_id_fkey";
            columns: ["initiative_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
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
      workspaces: {
        Row: {
          id: string;
          name: string;
          type: "standard" | "intelligence";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: "standard" | "intelligence";
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: "standard" | "intelligence";
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          invited_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          invited_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          invited_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_invited_by_fkey";
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
          project_id: string | null;
          workspace_id: string;
          title: string;
          content: string | null;
          capture_type: "meeting_note" | "document" | "media" | "thought" | null;
          occurred_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          workspace_id: string;
          title: string;
          content?: string | null;
          capture_type?: "meeting_note" | "document" | "media" | "thought" | null;
          occurred_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          workspace_id?: string;
          title?: string;
          content?: string | null;
          capture_type?: "meeting_note" | "document" | "media" | "thought" | null;
          occurred_at?: string | null;
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
            foreignKeyName: "notes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
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
      sections: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sections_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      feedback_forms: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          slug: string;
          password_hash: string;
          password_plain: string | null;
          password_version: number;
          fields: Json;
          ai_builder_history: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          slug: string;
          password_hash: string;
          password_plain?: string | null;
          password_version?: number;
          fields?: Json;
          ai_builder_history?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          slug?: string;
          password_hash?: string;
          password_plain?: string | null;
          password_version?: number;
          fields?: Json;
          ai_builder_history?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_forms_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      feedback_submissions: {
        Row: {
          id: string;
          form_id: string;
          raw_contents: Json;
          followup_transcript: Json | null;
          final_contents: Json | null;
          task_id: string | null;
          submitted_at: string;
          followup_complete: boolean;
        };
        Insert: {
          id?: string;
          form_id: string;
          raw_contents: Json;
          followup_transcript?: Json | null;
          final_contents?: Json | null;
          task_id?: string | null;
          submitted_at?: string;
          followup_complete?: boolean;
        };
        Update: {
          id?: string;
          form_id?: string;
          raw_contents?: Json;
          followup_transcript?: Json | null;
          final_contents?: Json | null;
          task_id?: string | null;
          submitted_at?: string;
          followup_complete?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_submissions_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "feedback_forms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_submissions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      entities: {
        Row: {
          id: string;
          workspace_id: string;
          entity_type: "product" | "initiative" | "stakeholder";
          name: string;
          slug: string;
          description: string | null;
          foundational_context: string | null;
          ai_memory: string | null;
          memory_refreshed_at: string | null;
          memory_guidance: string | null;
          memory_source_hash: string | null;
          metadata: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          entity_type: "product" | "initiative" | "stakeholder";
          name: string;
          slug: string;
          description?: string | null;
          foundational_context?: string | null;
          ai_memory?: string | null;
          memory_refreshed_at?: string | null;
          memory_guidance?: string | null;
          memory_source_hash?: string | null;
          metadata?: Json;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          entity_type?: "product" | "initiative" | "stakeholder";
          name?: string;
          slug?: string;
          description?: string | null;
          foundational_context?: string | null;
          ai_memory?: string | null;
          memory_refreshed_at?: string | null;
          memory_guidance?: string | null;
          memory_source_hash?: string | null;
          metadata?: Json;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entities_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      entity_links: {
        Row: {
          id: string;
          source_entity_id: string;
          target_entity_id: string;
          link_type: "initiative_product" | "stakeholder_product" | "stakeholder_initiative";
          created_at: string;
        };
        Insert: {
          id?: string;
          source_entity_id: string;
          target_entity_id: string;
          link_type: "initiative_product" | "stakeholder_product" | "stakeholder_initiative";
          created_at?: string;
        };
        Update: {
          id?: string;
          source_entity_id?: string;
          target_entity_id?: string;
          link_type?: "initiative_product" | "stakeholder_product" | "stakeholder_initiative";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_links_source_entity_id_fkey";
            columns: ["source_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_links_target_entity_id_fkey";
            columns: ["target_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          }
        ];
      };
      entity_mentions: {
        Row: {
          id: string;
          entity_id: string;
          workspace_id: string;
          source_type: "note" | "comment" | "task_description" | "capture";
          source_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          workspace_id: string;
          source_type: "note" | "comment" | "task_description" | "capture";
          source_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          workspace_id?: string;
          source_type?: "note" | "comment" | "task_description" | "capture";
          source_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_mentions_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_mentions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          }
        ];
      };
      task_entities: {
        Row: {
          id: string;
          task_id: string;
          entity_id: string;
          entity_type: "product" | "initiative" | "stakeholder";
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          entity_id: string;
          entity_type: "product" | "initiative" | "stakeholder";
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          entity_id?: string;
          entity_type?: "product" | "initiative" | "stakeholder";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_entities_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_entities_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          }
        ];
      };
      entity_context_entries: {
        Row: {
          id: string;
          entity_id: string;
          content: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          content: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          content?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_context_entries_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_context_entries_created_by_fkey";
            columns: ["created_by"];
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

export type Section = Tables<"sections">;
export type SectionInsert = InsertTables<"sections">;
export type SectionUpdate = UpdateTables<"sections">;

// Entity type for polymorphic relationships (time entries, etc.)
export type TimeTrackingEntityType = "task" | "note" | "project";

export type FeedbackForm = Tables<"feedback_forms">;
export type FeedbackFormInsert = InsertTables<"feedback_forms">;
export type FeedbackFormUpdate = UpdateTables<"feedback_forms">;

export type FeedbackSubmission = Tables<"feedback_submissions">;
export type FeedbackSubmissionInsert = InsertTables<"feedback_submissions">;
export type FeedbackSubmissionUpdate = UpdateTables<"feedback_submissions">;

export type Workspace = Tables<"workspaces">;
export type WorkspaceInsert = InsertTables<"workspaces">;
export type WorkspaceUpdate = UpdateTables<"workspaces">;

export type WorkspaceMember = Tables<"workspace_members">;
export type WorkspaceMemberInsert = InsertTables<"workspace_members">;
export type WorkspaceMemberUpdate = UpdateTables<"workspace_members">;

export type WorkspaceType = "standard" | "intelligence";
export type CaptureType = "meeting_note" | "document" | "media" | "thought";

export type Entity = Tables<"entities">;
export type EntityInsert = InsertTables<"entities">;
export type EntityUpdate = UpdateTables<"entities">;

export type EntityLink = Tables<"entity_links">;
export type EntityLinkInsert = InsertTables<"entity_links">;

export type EntityMention = Tables<"entity_mentions">;
export type EntityMentionInsert = InsertTables<"entity_mentions">;

export type EntityContextEntry = Tables<"entity_context_entries">;
export type EntityContextEntryInsert = InsertTables<"entity_context_entries">;
export type EntityContextEntryUpdate = UpdateTables<"entity_context_entries">;

export type EntityType = "product" | "initiative" | "stakeholder";
export type EntityLinkType = "initiative_product" | "stakeholder_product" | "stakeholder_initiative";
export type MentionSourceType = "note" | "comment" | "task_description" | "capture";
