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
      platform_destructive_actions: {
        Row: {
          action_type: string
          created_at: string
          error_message: string | null
          id: string
          performed_by_profile_id: string | null
          reason: string
          result_status: string
          summary: Json
          target_account_id: string | null
          target_account_name: string
        }
        Insert: {
          action_type: string
          created_at?: string
          error_message?: string | null
          id?: string
          performed_by_profile_id?: string | null
          reason: string
          result_status?: string
          summary?: Json
          target_account_id?: string | null
          target_account_name: string
        }
        Update: {
          action_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          performed_by_profile_id?: string | null
          reason?: string
          result_status?: string
          summary?: Json
          target_account_id?: string | null
          target_account_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_destructive_actions_performed_by_profile_id_fkey"
            columns: ["performed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string | null
          id: string
          institution_limit: number
          name: string
          owner_profile_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          institution_limit?: number
          name: string
          owner_profile_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          institution_limit?: number
          name?: string
          owner_profile_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_admin_invitations: {
        Row: {
          accepted_at: string | null
          account_id: string
          attempt_count: number
          created_at: string
          email: string
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          profile_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          attempt_count?: number
          created_at?: string
          email: string
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          profile_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          attempt_count?: number
          created_at?: string
          email?: string
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          profile_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_admin_invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_admin_invitations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          active: boolean | null
          created_at: string | null
          end_date: string
          id: string
          institution_id: string
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          end_date: string
          id?: string
          institution_id: string
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string
          id?: string
          institution_id?: string
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_class_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "academic_years_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_student_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "academic_years_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_teacher_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "academic_years_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year_id: string
          active: boolean | null
          capacity: number | null
          created_at: string | null
          grade_level: string | null
          id: string
          institution_id: string
          name: string
          shift: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          active?: boolean | null
          capacity?: number | null
          created_at?: string | null
          grade_level?: string | null
          id?: string
          institution_id: string
          name: string
          shift?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          active?: boolean | null
          capacity?: number | null
          created_at?: string | null
          grade_level?: string | null
          id?: string
          institution_id?: string
          name?: string
          shift?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_class_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_student_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_teacher_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          academic_year_id: string
          active: boolean | null
          class_id: string
          created_at: string | null
          enrolled_at: string | null
          id: string
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          active?: boolean | null
          class_id: string
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          active?: boolean | null
          class_id?: string
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardianships: {
        Row: {
          active: boolean | null
          created_at: string | null
          guardian_profile_id: string
          id: string
          is_primary: boolean | null
          relationship: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          guardian_profile_id: string
          id?: string
          is_primary?: boolean | null
          relationship: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          guardian_profile_id?: string
          id?: string
          is_primary?: boolean | null
          relationship?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardianships_guardian_profile_id_fkey"
            columns: ["guardian_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardianships_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          account_id: string | null
          active: boolean | null
          address: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          subdomain: string | null
          suspended_at: string | null
          suspended_by_profile_id: string | null
          suspended_by_scope: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          subdomain?: string | null
          suspended_at?: string | null
          suspended_by_profile_id?: string | null
          suspended_by_scope?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          subdomain?: string | null
          suspended_at?: string | null
          suspended_by_profile_id?: string | null
          suspended_by_scope?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean | null
          id: string
          institution_id: string
          joined_at: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean | null
          id?: string
          institution_id: string
          joined_at?: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean | null
          id?: string
          institution_id?: string
          joined_at?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_class_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_student_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_teacher_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      student_registration_counters: {
        Row: {
          institution_id: string
          last_value: number
          registration_year: number
        }
        Insert: {
          institution_id: string
          last_value?: number
          registration_year: number
        }
        Update: {
          institution_id?: string
          last_value?: number
          registration_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_registration_counters_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_class_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_registration_counters_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_student_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_registration_counters_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_teacher_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_registration_counters_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean | null
          birth_date: string | null
          cpf: string | null
          created_at: string | null
          id: string
          institution_id: string
          profile_id: string
          registration_number: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          institution_id: string
          profile_id: string
          registration_number: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          institution_id?: string
          profile_id?: string
          registration_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_class_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_student_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_teacher_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_offerings: {
        Row: {
          active: boolean | null
          class_id: string
          created_at: string | null
          id: string
          subject_id: string
          teacher_profile_id: string
          term_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          class_id: string
          created_at?: string | null
          id?: string
          subject_id: string
          teacher_profile_id: string
          term_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          class_id?: string
          created_at?: string | null
          id?: string
          subject_id?: string
          teacher_profile_id?: string
          term_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_offerings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_teacher_profile_id_fkey"
            columns: ["teacher_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_offerings_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          id: string
          institution_id: string
          name: string
          updated_at: string | null
          workload: number | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string
          institution_id: string
          name: string
          updated_at?: string | null
          workload?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string
          institution_id?: string
          name?: string
          updated_at?: string | null
          workload?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_class_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_student_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "director_teacher_summary"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string
          active: boolean | null
          created_at: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          active?: boolean | null
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          active?: boolean | null
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      director_alerts: {
        Row: {
          alert_type: string | null
          attendance_percentage: number | null
          institution_id: string | null
          student_id: string | null
          student_name: string | null
        }
        Relationships: []
      }
      director_class_summary: {
        Row: {
          active_classes: number | null
          avg_students_per_class: number | null
          institution_id: string | null
          total_classes: number | null
        }
        Relationships: []
      }
      director_student_summary: {
        Row: {
          active_students: number | null
          enrolled_students: number | null
          institution_id: string | null
          total_students: number | null
        }
        Relationships: []
      }
      director_teacher_summary: {
        Row: {
          active_teachers: number | null
          institution_id: string | null
          total_teachers: number | null
        }
        Relationships: []
      }
      director_upcoming_events: {
        Row: {
          description: string | null
          end_date: string | null
          id: string | null
          institution_id: string | null
          location: string | null
          start_date: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      mark_client_admin_invitation_accepted: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      hard_delete_client_account: {
        Args: {
          acknowledgement: boolean
          actor_profile_id: string
          change_reason: string
          confirmation_email: string
          confirmation_text: string
          target_account_id: string
        }
        Returns: Json
      }
      restore_client_account: {
        Args: {
          actor_profile_id: string
          change_reason?: string
          target_account_id: string
        }
        Returns: {
          account_id: string
          audit_event_id: string | null
          institution_limit: number
          new_status: string
          previous_status: string
          status_changed: boolean
        }[]
      }
      can_view_institution_profile: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      generate_student_registration_number: {
        Args: { target_institution_id: string }
        Returns: string
      }
      accept_camera_gateway_request: {
        Args: {
          target_gateway_id: string
          target_gateway_token: string
          target_request_id: string
          target_request_expires_at: string
        }
        Returns: boolean
      }
      is_institution_admin: {
        Args: { target_institution_id: string }
        Returns: boolean
      }
      pair_camera_gateway_runtime: {
        Args: { gateway_local_url: string; target_pairing_code: string }
        Returns: {
          gateway_id: string
          institution_id: string
          gateway_token: string
          local_base_url: string | null
          paired_at: string
        }[]
      }
      heartbeat_camera_gateway_runtime: {
        Args: {
          target_gateway_id: string
          target_gateway_token: string
          target_request_id: string
          target_request_expires_at: string
        }
        Returns: boolean
      }
      sync_camera_gateway_runtime: {
        Args: {
          target_gateway_id: string
          target_gateway_token: string
          target_request_id: string
          target_request_expires_at: string
        }
        Returns: {
          id: string
          institution_id: string
          name: string
          host: string
          port: number
          protocol: "ONVIF" | "RTSP"
          channel: number | null
          stream_profile: "MAIN" | "SUB"
          active: boolean
        }[]
      }
      create_camera_stream_session: {
        Args: { target_camera_id: string }
        Returns: {
          session_id: string
          protocol: string
          playback_url: string | null
          expires_at: string
        }[]
      }
      redeem_camera_stream_session: {
        Args: {
          target_gateway_id: string
          target_gateway_token: string
          target_session_id: string
          target_session_token: string
          target_request_id: string
          target_request_expires_at: string
        }
        Returns: {
          camera_id: string
          institution_id: string
          stream_path: string
          expires_at: string
        }[]
      }
    }
    Enums: {
      platform_role: "USER" | "SUPER_ADMIN"
      user_role:
        | "ADMIN"
        | "DIRECTOR"
        | "SECRETARY"
        | "TEACHER"
        | "STUDENT"
        | "GUARDIAN"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      platform_role: ["USER", "SUPER_ADMIN"],
      user_role: [
        "ADMIN",
        "DIRECTOR",
        "SECRETARY",
        "TEACHER",
        "STUDENT",
        "GUARDIAN",
      ],
    },
  },
} as const
