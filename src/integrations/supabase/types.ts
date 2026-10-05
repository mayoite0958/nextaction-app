export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          app: string | null
          domain: string | null
          duration_sec: number | null
          id: string
          relevance: string | null
          session_id: string | null
          ts: string | null
          user_id: string
          window_title: string | null
        }
        Insert: {
          app?: string | null
          domain?: string | null
          duration_sec?: number | null
          id?: string
          relevance?: string | null
          session_id?: string | null
          ts?: string | null
          user_id?: string
          window_title?: string | null
        }
        Update: {
          app?: string | null
          domain?: string | null
          duration_sec?: number | null
          id?: string
          relevance?: string | null
          session_id?: string | null
          ts?: string | null
          user_id?: string
          window_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          created_at: string | null
          id: string
          project_id: string | null
          source: string | null
          text: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          source?: string | null
          text?: string | null
          type?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          source?: string | null
          text?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          blocker: string | null
          bucket: string | null
          count_done: number | null
          count_total: number | null
          created_at: string | null
          deadline: string | null
          done_definition: string | null
          goal: string | null
          id: string
          last_meaningful_action: string | null
          last_worked_at: string | null
          milestones: Json | null
          name: string
          next_likely_action: string | null
          progress_percent: number | null
          progress_summary: string | null
          project_type: string | null
          status: string | null
          user_id: string
          value_score: number | null
          weekly_target: number | null
        }
        Insert: {
          blocker?: string | null
          bucket?: string | null
          count_done?: number | null
          count_total?: number | null
          created_at?: string | null
          deadline?: string | null
          done_definition?: string | null
          goal?: string | null
          id?: string
          last_meaningful_action?: string | null
          last_worked_at?: string | null
          milestones?: Json | null
          name: string
          next_likely_action?: string | null
          progress_percent?: number | null
          progress_summary?: string | null
          project_type?: string | null
          status?: string | null
          user_id?: string
          value_score?: number | null
          weekly_target?: number | null
        }
        Update: {
          blocker?: string | null
          bucket?: string | null
          count_done?: number | null
          count_total?: number | null
          created_at?: string | null
          deadline?: string | null
          done_definition?: string | null
          goal?: string | null
          id?: string
          last_meaningful_action?: string | null
          last_worked_at?: string | null
          milestones?: Json | null
          name?: string
          next_likely_action?: string | null
          progress_percent?: number | null
          progress_summary?: string | null
          project_type?: string | null
          status?: string | null
          user_id?: string
          value_score?: number | null
          weekly_target?: number | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          classified: boolean | null
          created_at: string | null
          id: string
          problem_helped: string | null
          project_id: string | null
          resource_type: string | null
          source: string | null
          summary: string | null
          title: string | null
          topic: string | null
          url: string | null
          usefulness: string | null
          user_id: string
          user_note: string | null
        }
        Insert: {
          classified?: boolean | null
          created_at?: string | null
          id?: string
          problem_helped?: string | null
          project_id?: string | null
          resource_type?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          topic?: string | null
          url?: string | null
          usefulness?: string | null
          user_id?: string
          user_note?: string | null
        }
        Update: {
          classified?: boolean | null
          created_at?: string | null
          id?: string
          problem_helped?: string | null
          project_id?: string | null
          resource_type?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          topic?: string | null
          url?: string | null
          usefulness?: string | null
          user_id?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          id: string
          session_id: string | null
          text: string | null
          ts: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          text?: string | null
          ts?: string | null
          type?: string | null
          user_id?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          text?: string | null
          ts?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          arm: string | null
          created_at: string | null
          decision_started_at: string | null
          done_looks_like: string | null
          ended_at: string | null
          energy: string | null
          id: string
          less_stuck: number | null
          milestone_moved: boolean | null
          outcome: string | null
          pending_update: Json | null
          project_id: string | null
          project_name: string | null
          reason: string | null
          recommended_action: string | null
          resource_id: string | null
          resource_used: boolean | null
          right_task: number | null
          source: string | null
          status: string | null
          switch_events: number | null
          task_id: string | null
          time_available_min: number | null
          user_correction: string | null
          user_id: string
          where_stopped: string | null
          work_started_at: string | null
        }
        Insert: {
          arm?: string | null
          created_at?: string | null
          decision_started_at?: string | null
          done_looks_like?: string | null
          ended_at?: string | null
          energy?: string | null
          id?: string
          less_stuck?: number | null
          milestone_moved?: boolean | null
          outcome?: string | null
          pending_update?: Json | null
          project_id?: string | null
          project_name?: string | null
          reason?: string | null
          recommended_action?: string | null
          resource_id?: string | null
          resource_used?: boolean | null
          right_task?: number | null
          source?: string | null
          status?: string | null
          switch_events?: number | null
          task_id?: string | null
          time_available_min?: number | null
          user_correction?: string | null
          user_id?: string
          where_stopped?: string | null
          work_started_at?: string | null
        }
        Update: {
          arm?: string | null
          created_at?: string | null
          decision_started_at?: string | null
          done_looks_like?: string | null
          ended_at?: string | null
          energy?: string | null
          id?: string
          less_stuck?: number | null
          milestone_moved?: boolean | null
          outcome?: string | null
          pending_update?: Json | null
          project_id?: string | null
          project_name?: string | null
          reason?: string | null
          recommended_action?: string | null
          resource_id?: string | null
          resource_used?: boolean | null
          right_task?: number | null
          source?: string | null
          status?: string | null
          switch_events?: number | null
          task_id?: string | null
          time_available_min?: number | null
          user_correction?: string | null
          user_id?: string
          where_stopped?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string | null
          done_at: string | null
          due_date: string | null
          energy: string | null
          est_minutes: number | null
          id: string
          milestone: string | null
          project_id: string | null
          source: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          done_at?: string | null
          due_date?: string | null
          energy?: string | null
          est_minutes?: number | null
          id?: string
          milestone?: string | null
          project_id?: string | null
          source?: string | null
          status?: string | null
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string | null
          done_at?: string | null
          due_date?: string | null
          energy?: string | null
          est_minutes?: number | null
          id?: string
          milestone?: string | null
          project_id?: string | null
          source?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      urgent_items: {
        Row: {
          company: string | null
          created_at: string | null
          deadline: string | null
          id: string
          project_id: string | null
          required_action: string | null
          source_message_id: string | null
          status: string | null
          urgency: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          project_id?: string | null
          required_action?: string | null
          source_message_id?: string | null
          status?: string | null
          urgency?: string | null
          user_id?: string
        }
        Update: {
          company?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          project_id?: string | null
          required_action?: string | null
          source_message_id?: string | null
          status?: string | null
          urgency?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "urgent_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          bucket_longterm_label: string | null
          bucket_urgent_label: string | null
          category_targets: Json | null
          coaching_tone: string | null
          consent_given_at: string | null
          created_at: string | null
          display_name: string | null
          distraction_sites: string[] | null
          email_forward_tag: string | null
          guard_mode: string | null
          last_capture_at: string | null
          morning_brief_enabled: boolean | null
          morning_brief_time: string | null
          priority_notes: string | null
          reply_language: string | null
          role_template: string | null
          session_lengths: number[] | null
          timezone: string | null
          urgent_share: number | null
          user_id: string
          value_label: string | null
          whatsapp_link_code: string | null
          whatsapp_number: string | null
          whatsapp_verified: boolean | null
        }
        Insert: {
          bucket_longterm_label?: string | null
          bucket_urgent_label?: string | null
          category_targets?: Json | null
          coaching_tone?: string | null
          consent_given_at?: string | null
          created_at?: string | null
          display_name?: string | null
          distraction_sites?: string[] | null
          email_forward_tag?: string | null
          guard_mode?: string | null
          last_capture_at?: string | null
          morning_brief_enabled?: boolean | null
          morning_brief_time?: string | null
          priority_notes?: string | null
          reply_language?: string | null
          role_template?: string | null
          session_lengths?: number[] | null
          timezone?: string | null
          urgent_share?: number | null
          user_id: string
          value_label?: string | null
          whatsapp_link_code?: string | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
        }
        Update: {
          bucket_longterm_label?: string | null
          bucket_urgent_label?: string | null
          category_targets?: Json | null
          coaching_tone?: string | null
          consent_given_at?: string | null
          created_at?: string | null
          display_name?: string | null
          distraction_sites?: string[] | null
          email_forward_tag?: string | null
          guard_mode?: string | null
          last_capture_at?: string | null
          morning_brief_enabled?: boolean | null
          morning_brief_time?: string | null
          priority_notes?: string | null
          reply_language?: string | null
          role_template?: string | null
          session_lengths?: number[] | null
          timezone?: string | null
          urgent_share?: number | null
          user_id?: string
          value_label?: string | null
          whatsapp_link_code?: string | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
