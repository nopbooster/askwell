export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          clerk_user_id: string
          plan: string
          created_at: string
        }
        Insert: {
          clerk_user_id: string
          plan?: string
          created_at?: string
        }
        Update: {
          clerk_user_id?: string
          plan?: string
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          public_key: string
          messages_used: number
          period_start: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          public_key: string
          messages_used?: number
          period_start?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          public_key?: string
          messages_used?: number
          period_start?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      widget_configs: {
        Row: {
          project_id: string
          button_color: string
          position: string
          label: string
          animation: string
          header_text: string
          show_badge: boolean
        }
        Insert: {
          project_id: string
          button_color?: string
          position?: string
          label?: string
          animation?: string
          header_text?: string
          show_badge?: boolean
        }
        Update: {
          project_id?: string
          button_color?: string
          position?: string
          label?: string
          animation?: string
          header_text?: string
          show_badge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "widget_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          id: string
          project_id: string
          title: string
          type: string
          storage_key: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          type: string
          storage_key?: string | null
          status: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          type?: string
          storage_key?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          id: string
          project_id: string
          source_id: string
          content: string
          embedding: string
        }
        Insert: {
          id?: string
          project_id: string
          source_id: string
          content: string
          embedding: string
        }
        Update: {
          id?: string
          project_id?: string
          source_id?: string
          content?: string
          embedding?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_project_id_fkey"
            columns: ["source_id", "project_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          project_id: string
          visitor_id: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          visitor_id: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          visitor_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owned_conversation_ids: {
        Args: never
        Returns: string[]
      }
      owned_project_ids: {
        Args: never
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
