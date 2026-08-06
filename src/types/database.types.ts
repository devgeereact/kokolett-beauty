export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          acted_at: string | null;
          acted_by: string | null;
          confidence: number | null;
          created_at: string;
          id: string;
          kind: string;
          payload: Json;
          rationale: string | null;
          status: Database['public']['Enums']['recommendation_status'];
          title: string;
          updated_at: string;
        };
        Insert: {
          acted_at?: string | null;
          acted_by?: string | null;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          kind: string;
          payload?: Json;
          rationale?: string | null;
          status?: Database['public']['Enums']['recommendation_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          acted_at?: string | null;
          acted_by?: string | null;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          rationale?: string | null;
          status?: Database['public']['Enums']['recommendation_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_recommendations_acted_by_fkey';
            columns: ['acted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          created_at: string;
          id: string;
          notifications_enabled: boolean;
          theme: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notifications_enabled?: boolean;
          theme?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notifications_enabled?: boolean;
          theme?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'app_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: {
          approval_deadline: string | null;
          approved_at: string | null;
          approved_by: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          customer_note: string | null;
          ends_at: string;
          id: string;
          owner_note: string | null;
          price_pence: number;
          reference: string;
          rejected_at: string | null;
          rejection_reason: string | null;
          requires_approval: boolean;
          rescheduled_from: string | null;
          review_requested_at: string | null;
          service_id: string;
          source: string;
          starts_at: string;
          status: Database['public']['Enums']['appointment_status'];
          updated_at: string;
        };
        Insert: {
          approval_deadline?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id: string;
          customer_note?: string | null;
          ends_at: string;
          id?: string;
          owner_note?: string | null;
          price_pence: number;
          reference: string;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          requires_approval?: boolean;
          rescheduled_from?: string | null;
          review_requested_at?: string | null;
          service_id: string;
          source?: string;
          starts_at: string;
          status?: Database['public']['Enums']['appointment_status'];
          updated_at?: string;
        };
        Update: {
          approval_deadline?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          customer_note?: string | null;
          ends_at?: string;
          id?: string;
          owner_note?: string | null;
          price_pence?: number;
          reference?: string;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          requires_approval?: boolean;
          rescheduled_from?: string | null;
          review_requested_at?: string | null;
          service_id?: string;
          source?: string;
          starts_at?: string;
          status?: Database['public']['Enums']['appointment_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_rescheduled_from_fkey';
            columns: ['rescheduled_from'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_rescheduled_from_fkey';
            columns: ['rescheduled_from'];
            isOneToOne: false;
            referencedRelation: 'appointments_detailed';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_exceptions: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          kind: Database['public']['Enums']['exception_kind'];
          on_date: string;
          reason: string | null;
          starts_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          kind: Database['public']['Enums']['exception_kind'];
          on_date: string;
          reason?: string | null;
          starts_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['exception_kind'];
          on_date?: string;
          reason?: string | null;
          starts_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      availability_requests: {
        Row: {
          converted_appointment_id: string | null;
          created_at: string;
          customer_id: string | null;
          email: string;
          flexibility: string;
          full_name: string;
          id: string;
          mobile: string | null;
          notes: string | null;
          owner_response: string | null;
          preferred_dates: string[];
          preferred_times: string | null;
          responded_at: string | null;
          service_id: string | null;
          status: Database['public']['Enums']['availability_request_status'];
          updated_at: string;
        };
        Insert: {
          converted_appointment_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email: string;
          flexibility?: string;
          full_name: string;
          id?: string;
          mobile?: string | null;
          notes?: string | null;
          owner_response?: string | null;
          preferred_dates?: string[];
          preferred_times?: string | null;
          responded_at?: string | null;
          service_id?: string | null;
          status?: Database['public']['Enums']['availability_request_status'];
          updated_at?: string;
        };
        Update: {
          converted_appointment_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          email?: string;
          flexibility?: string;
          full_name?: string;
          id?: string;
          mobile?: string | null;
          notes?: string | null;
          owner_response?: string | null;
          preferred_dates?: string[];
          preferred_times?: string | null;
          responded_at?: string | null;
          service_id?: string | null;
          status?: Database['public']['Enums']['availability_request_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_requests_converted_appointment_id_fkey';
            columns: ['converted_appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_requests_converted_appointment_id_fkey';
            columns: ['converted_appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments_detailed';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_requests_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_requests_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_rules: {
        Row: {
          closes_at: string;
          created_at: string;
          day_of_week: number;
          id: string;
          is_open: boolean;
          opens_at: string;
          updated_at: string;
        };
        Insert: {
          closes_at: string;
          created_at?: string;
          day_of_week: number;
          id?: string;
          is_open?: boolean;
          opens_at: string;
          updated_at?: string;
        };
        Update: {
          closes_at?: string;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          is_open?: boolean;
          opens_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      booking_settings: {
        Row: {
          approval_window_h: number;
          approve_first_time: boolean;
          cancellation_window_h: number;
          created_at: string;
          default_buffer_min: number;
          google_review_url: string | null;
          id: boolean;
          lead_time_min: number;
          max_appointments_per_day: number;
          max_horizon_days: number;
          slot_granularity_min: number;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          approval_window_h?: number;
          approve_first_time?: boolean;
          cancellation_window_h?: number;
          created_at?: string;
          default_buffer_min?: number;
          google_review_url?: string | null;
          id?: boolean;
          lead_time_min?: number;
          max_appointments_per_day?: number;
          max_horizon_days?: number;
          slot_granularity_min?: number;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          approval_window_h?: number;
          approve_first_time?: boolean;
          cancellation_window_h?: number;
          created_at?: string;
          default_buffer_min?: number;
          google_review_url?: string | null;
          id?: boolean;
          lead_time_min?: number;
          max_appointments_per_day?: number;
          max_horizon_days?: number;
          slot_granularity_min?: number;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_access_tokens: {
        Row: {
          created_at: string;
          customer_id: string;
          expires_at: string;
          id: string;
          purpose: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          expires_at: string;
          id?: string;
          purpose?: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          expires_at?: string;
          id?: string;
          purpose?: string;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_access_tokens_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          consent_updated_at: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          first_seen_at: string;
          full_name: string;
          id: string;
          last_seen_at: string | null;
          marketing_consent: boolean;
          mobile: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          consent_updated_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          first_seen_at?: string;
          full_name: string;
          id?: string;
          last_seen_at?: string | null;
          marketing_consent?: boolean;
          mobile?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          consent_updated_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          first_seen_at?: string;
          full_name?: string;
          id?: string;
          last_seen_at?: string | null;
          marketing_consent?: boolean;
          mobile?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_messages: {
        Row: {
          appointment_id: string | null;
          attempts: number;
          created_at: string;
          customer_id: string | null;
          id: string;
          last_error: string | null;
          provider_id: string | null;
          scheduled_for: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['email_status'];
          subject: string;
          template: string;
          to_email: string;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          attempts?: number;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          last_error?: string | null;
          provider_id?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['email_status'];
          subject: string;
          template: string;
          to_email: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          attempts?: number;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          last_error?: string | null;
          provider_id?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['email_status'];
          subject?: string;
          template?: string;
          to_email?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_messages_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_messages_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments_detailed';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_messages_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          archived_at: string | null;
          buffer_min: number;
          category_id: string | null;
          created_at: string;
          description: string | null;
          duration_min: number;
          id: string;
          image_path: string | null;
          is_active: boolean;
          name: string;
          price_pence: number;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          buffer_min?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_min: number;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name: string;
          price_pence: number;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          buffer_min?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_min?: number;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name?: string;
          price_pence?: number;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'service_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      staff: {
        Row: {
          created_at: string;
          id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      appointments_detailed: {
        Row: {
          approval_deadline: string | null;
          approved_at: string | null;
          approved_by: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string | null;
          customer_completed_count: number | null;
          customer_email: string | null;
          customer_id: string | null;
          customer_marketing_consent: boolean | null;
          customer_mobile: string | null;
          customer_name: string | null;
          customer_note: string | null;
          ends_at: string | null;
          id: string | null;
          owner_note: string | null;
          price_pence: number | null;
          reference: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          requires_approval: boolean | null;
          rescheduled_from: string | null;
          review_requested_at: string | null;
          service_buffer_min: number | null;
          service_duration_min: number | null;
          service_id: string | null;
          service_name: string | null;
          service_slug: string | null;
          source: string | null;
          starts_at: string | null;
          status: Database['public']['Enums']['appointment_status'] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_rescheduled_from_fkey';
            columns: ['rescheduled_from'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_rescheduled_from_fkey';
            columns: ['rescheduled_from'];
            isOneToOne: false;
            referencedRelation: 'appointments_detailed';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      approve_appointment: {
        Args: { p_appointment_id: string };
        Returns: {
          approval_deadline: string | null;
          approved_at: string | null;
          approved_by: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          customer_note: string | null;
          ends_at: string;
          id: string;
          owner_note: string | null;
          price_pence: number;
          reference: string;
          rejected_at: string | null;
          rejection_reason: string | null;
          requires_approval: boolean;
          rescheduled_from: string | null;
          review_requested_at: string | null;
          service_id: string;
          source: string;
          starts_at: string;
          status: Database['public']['Enums']['appointment_status'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'appointments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      book_appointment: {
        Args: {
          p_consent?: boolean;
          p_email: string;
          p_full_name: string;
          p_mobile?: string;
          p_note?: string;
          p_service_id: string;
          p_starts_at: string;
        };
        Returns: {
          appointment_id: string;
          reference: string;
          status: Database['public']['Enums']['appointment_status'];
        }[];
      };
      create_appointment_as_owner: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_mobile?: string;
          p_note?: string;
          p_service_id: string;
          p_starts_at: string;
        };
        Returns: {
          appointment_id: string;
          reference: string;
        }[];
      };
      expire_pending_approvals: { Args: never; Returns: number };
      generate_booking_reference: { Args: never; Returns: string };
      is_owner: { Args: never; Returns: boolean };
      owner_dashboard_summary: { Args: never; Returns: Json };
      reject_appointment: {
        Args: { p_appointment_id: string; p_reason?: string };
        Returns: {
          approval_deadline: string | null;
          approved_at: string | null;
          approved_by: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          customer_note: string | null;
          ends_at: string;
          id: string;
          owner_note: string | null;
          price_pence: number;
          reference: string;
          rejected_at: string | null;
          rejection_reason: string | null;
          requires_approval: boolean;
          rescheduled_from: string | null;
          review_requested_at: string | null;
          service_id: string;
          source: string;
          starts_at: string;
          status: Database['public']['Enums']['appointment_status'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'appointments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_appointment_status: {
        Args: {
          p_appointment_id: string;
          p_reason?: string;
          p_status: Database['public']['Enums']['appointment_status'];
        };
        Returns: {
          approval_deadline: string | null;
          approved_at: string | null;
          approved_by: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          customer_note: string | null;
          ends_at: string;
          id: string;
          owner_note: string | null;
          price_pence: number;
          reference: string;
          rejected_at: string | null;
          rejection_reason: string | null;
          requires_approval: boolean;
          rescheduled_from: string | null;
          review_requested_at: string | null;
          service_id: string;
          source: string;
          starts_at: string;
          status: Database['public']['Enums']['appointment_status'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'appointments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      appointment_status:
        | 'pending_approval'
        | 'confirmed'
        | 'checked_in'
        | 'in_service'
        | 'completed'
        | 'cancelled'
        | 'rejected'
        | 'rescheduled'
        | 'no_show';
      availability_request_status:
        'new' | 'awaiting_response' | 'offer_sent' | 'converted' | 'declined' | 'expired';
      email_status: 'queued' | 'sending' | 'sent' | 'failed' | 'bounced';
      exception_kind: 'closure' | 'extra_hours' | 'break';
      recommendation_status: 'pending' | 'accepted' | 'dismissed' | 'expired';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        'pending_approval',
        'confirmed',
        'checked_in',
        'in_service',
        'completed',
        'cancelled',
        'rejected',
        'rescheduled',
        'no_show',
      ],
      availability_request_status: [
        'new',
        'awaiting_response',
        'offer_sent',
        'converted',
        'declined',
        'expired',
      ],
      email_status: ['queued', 'sending', 'sent', 'failed', 'bounced'],
      exception_kind: ['closure', 'extra_hours', 'break'],
      recommendation_status: ['pending', 'accepted', 'dismissed', 'expired'],
    },
  },
} as const;
