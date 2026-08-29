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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          confidence: number | null
          created_at: string
          id: string
          kind: string
          payload: Json
          rationale: string | null
          status: Database["public"]["Enums"]["recommendation_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          rationale?: string | null
          status?: Database["public"]["Enums"]["recommendation_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          rationale?: string | null
          status?: Database["public"]["Enums"]["recommendation_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_acted_by_fkey"
            columns: ["acted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          notifications_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notifications_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notifications_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          approval_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          ends_at: string
          id: string
          owner_note: string | null
          price_pence: number
          reference: string
          rejected_at: string | null
          rejection_reason: string | null
          requires_approval: boolean
          rescheduled_from: string | null
          review_requested_at: string | null
          service_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          approval_deadline?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_note?: string | null
          ends_at: string
          id?: string
          owner_note?: string | null
          price_pence: number
          reference: string
          rejected_at?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean
          rescheduled_from?: string | null
          review_requested_at?: string | null
          service_id: string
          source?: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          approval_deadline?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_note?: string | null
          ends_at?: string
          id?: string
          owner_note?: string | null
          price_pence?: number
          reference?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean
          rescheduled_from?: string | null
          review_requested_at?: string | null
          service_id?: string
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "appointments_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action:
            | "appointment.created"
            | "appointment.status_changed"
            | "appointment.rescheduled"
            | "appointment.deleted"
            | "customer.erased"
            | "payment.recorded"
            | "settings.login_slug_changed"
            | "day.closed"
          actor: "owner" | "system"
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          summary: string
        }
        Insert: {
          action:
            | "appointment.created"
            | "appointment.status_changed"
            | "appointment.rescheduled"
            | "appointment.deleted"
            | "customer.erased"
            | "payment.recorded"
            | "settings.login_slug_changed"
            | "day.closed"
          actor?: "owner" | "system"
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          summary: string
        }
        Update: {
          action?:
            | "appointment.created"
            | "appointment.status_changed"
            | "appointment.rescheduled"
            | "appointment.deleted"
            | "customer.erased"
            | "payment.recorded"
            | "settings.login_slug_changed"
            | "day.closed"
          actor?: "owner" | "system"
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          summary?: string
        }
        Relationships: []
      }
      availability_requests: {
        Row: {
          converted_appointment_id: string | null
          created_at: string
          customer_id: string | null
          email: string
          flexibility: string
          full_name: string
          id: string
          mobile: string | null
          notes: string | null
          owner_note: string | null
          owner_response: string | null
          preferred_dates: string[]
          preferred_times: string | null
          responded_at: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["availability_request_status"]
          updated_at: string
        }
        Insert: {
          converted_appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          email: string
          flexibility?: string
          full_name: string
          id?: string
          mobile?: string | null
          notes?: string | null
          owner_note?: string | null
          owner_response?: string | null
          preferred_dates?: string[]
          preferred_times?: string | null
          responded_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["availability_request_status"]
          updated_at?: string
        }
        Update: {
          converted_appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string
          flexibility?: string
          full_name?: string
          id?: string
          mobile?: string | null
          notes?: string | null
          owner_note?: string | null
          owner_response?: string | null
          preferred_dates?: string[]
          preferred_times?: string | null
          responded_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["availability_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_requests_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_requests_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          id: string
          note: string | null
          on_date: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          on_date: string
          starts_at: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          on_date?: string
          starts_at?: string
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          about_photo_path: string | null
          address_line: string | null
          approval_window_h: number
          approve_first_time: boolean
          business_category: string
          business_name: string
          cancellation_window_h: number
          country: string
          created_at: string
          default_buffer_min: number
          google_place_id: string | null
          google_review_url: string | null
          id: boolean
          instagram_url: string | null
          lead_time_min: number
          max_appointments_per_day: number
          max_horizon_days: number
          phone: string | null
          slot_granularity_min: number
          timezone: string
          updated_at: string
        }
        Insert: {
          about_photo_path?: string | null
          address_line?: string | null
          approval_window_h?: number
          approve_first_time?: boolean
          business_category?: string
          business_name?: string
          cancellation_window_h?: number
          country?: string
          created_at?: string
          default_buffer_min?: number
          google_place_id?: string | null
          google_review_url?: string | null
          id?: boolean
          instagram_url?: string | null
          lead_time_min?: number
          max_appointments_per_day?: number
          max_horizon_days?: number
          phone?: string | null
          slot_granularity_min?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          about_photo_path?: string | null
          address_line?: string | null
          approval_window_h?: number
          approve_first_time?: boolean
          business_category?: string
          business_name?: string
          cancellation_window_h?: number
          country?: string
          created_at?: string
          default_buffer_min?: number
          google_place_id?: string | null
          google_review_url?: string | null
          id?: boolean
          instagram_url?: string | null
          lead_time_min?: number
          max_appointments_per_day?: number
          max_horizon_days?: number
          phone?: string | null
          slot_granularity_min?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_feeds: {
        Row: {
          created_at: string
          fetch_count: number
          id: string
          label: string
          last_fetched_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          fetch_count?: number
          id?: string
          label?: string
          last_fetched_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          fetch_count?: number
          id?: string
          label?: string
          last_fetched_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      customer_access_tokens: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          purpose: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          purpose?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_access_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          consent_updated_at: string | null
          created_at: string
          deleted_at: string | null
          email: string
          first_seen_at: string
          full_name: string
          id: string
          last_seen_at: string | null
          marketing_consent: boolean
          mobile: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          consent_updated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          first_seen_at?: string
          full_name: string
          id?: string
          last_seen_at?: string | null
          marketing_consent?: boolean
          mobile?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          consent_updated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_seen_at?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          marketing_consent?: boolean
          mobile?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      day_decided: {
        Row: {
          decided_at: string
          decided_by: string
          on_date: string
        }
        Insert: {
          decided_at?: string
          decided_by?: string
          on_date: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          on_date?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          appointment_id: string | null
          attempts: number
          created_at: string
          customer_id: string | null
          id: string
          last_error: string | null
          payload: Json
          provider_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template: string
          to_email: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          provider_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template: string
          to_email: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          provider_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean
          allow_edit_before_sending: boolean
          category: string
          html_body: string
          include_in_automation: boolean
          key: string
          subject: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_edit_before_sending?: boolean
          category: string
          html_body: string
          include_in_automation?: boolean
          key: string
          subject: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_edit_before_sending?: boolean
          category?: string
          html_body?: string
          include_in_automation?: boolean
          key?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_place_snapshot: {
        Row: {
          fetched_at: string
          id: boolean
          last_error: string | null
          rating: number | null
          rating_count: number | null
        }
        Insert: {
          fetched_at?: string
          id?: boolean
          last_error?: string | null
          rating?: number | null
          rating_count?: number | null
        }
        Update: {
          fetched_at?: string
          id?: boolean
          last_error?: string | null
          rating?: number | null
          rating_count?: number | null
        }
        Relationships: []
      }
      google_reviews: {
        Row: {
          author_name: string
          author_url: string | null
          body: string | null
          fetched_at: string
          id: string
          profile_photo_url: string | null
          published_at: string | null
          rating: number
          relative_time: string | null
        }
        Insert: {
          author_name: string
          author_url?: string | null
          body?: string | null
          fetched_at?: string
          id: string
          profile_photo_url?: string | null
          published_at?: string | null
          rating: number
          relative_time?: string | null
        }
        Update: {
          author_name?: string
          author_url?: string | null
          body?: string | null
          fetched_at?: string
          id?: string
          profile_photo_url?: string | null
          published_at?: string | null
          rating?: number
          relative_time?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_pence: number
          appointment_id: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string
        }
        Insert: {
          amount_pence: number
          appointment_id: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by: string
        }
        Update: {
          amount_pence?: number
          appointment_id?: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      secret_login_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip_hash: string
        }
        Insert: {
          attempted_at?: string
          id?: number
          ip_hash: string
        }
        Update: {
          attempted_at?: string
          id?: number
          ip_hash?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_menu: {
        Row: {
          active: boolean
          buffer_min: number
          created_at: string
          duration_min: number
          group_name: string
          id: string
          image_path: string | null
          name: string
          note: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          buffer_min?: number
          created_at?: string
          duration_min?: number
          group_name: string
          id?: string
          image_path?: string | null
          name: string
          note?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          buffer_min?: number
          created_at?: string
          duration_min?: number
          group_name?: string
          id?: string
          image_path?: string | null
          name?: string
          note?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          archived_at: string | null
          buffer_min: number
          category_id: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          price_pence: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          buffer_min?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          price_pence: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          buffer_min?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          price_pence?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          id: string
          login_slug: string | null
          login_slug_updated_at: string
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          login_slug?: string | null
          login_slug_updated_at?: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          login_slug?: string | null
          login_slug_updated_at?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      weekly_template: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          starts_at: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          starts_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      appointments_detailed: {
        Row: {
          approval_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string | null
          customer_completed_count: number | null
          customer_email: string | null
          customer_id: string | null
          customer_marketing_consent: boolean | null
          customer_mobile: string | null
          customer_name: string | null
          customer_note: string | null
          ends_at: string | null
          id: string | null
          owner_note: string | null
          paid_pence: number | null
          price_pence: number | null
          reference: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requires_approval: boolean | null
          rescheduled_from: string | null
          review_requested_at: string | null
          service_buffer_min: number | null
          service_duration_min: number | null
          service_id: string | null
          service_name: string | null
          service_slug: string | null
          source: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "appointments_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_day_slot: {
        Args: { p_date: string; p_note?: string; p_time: string }
        Returns: string
      }
      apply_weekly_template: {
        Args: { p_from: string; p_replace?: boolean; p_to: string }
        Returns: {
          days_filled: number
          slots_written: number
        }[]
      }
      approve_appointment: {
        Args: { p_appointment_id: string }
        Returns: {
          approval_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          ends_at: string
          id: string
          owner_note: string | null
          price_pence: number
          reference: string
          rejected_at: string | null
          rejection_reason: string | null
          requires_approval: boolean
          rescheduled_from: string | null
          review_requested_at: string | null
          service_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      available_slots: {
        Args: { p_from: string; p_to: string }
        Returns: {
          slot_start: string
        }[]
      }
      book_appointment: {
        Args: {
          p_consent?: boolean
          p_email: string
          p_full_name: string
          p_mobile?: string
          p_note?: string
          p_starts_at: string
        }
        Returns: {
          appointment_id: string
          reference: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      booked_times_on: { Args: { p_date: string }; Returns: string[] }
      calendar_feed_events: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          customer_email: string
          customer_mobile: string
          customer_name: string
          customer_note: string
          ends_at: string
          first_visit: boolean
          id: string
          owner_note: string
          reference: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }[]
      }
      clear_day_slots: { Args: { p_date: string }; Returns: number }
      close_day: { Args: never; Returns: Json }
      copy_day_slots: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      create_appointment_as_owner: {
        Args: {
          p_duration_min?: number
          p_email: string
          p_full_name: string
          p_mobile?: string
          p_note?: string
          p_starts_at: string
        }
        Returns: {
          appointment_id: string
          reference: string
        }[]
      }
      create_calendar_feed: {
        Args: { p_label?: string }
        Returns: {
          id: string
          token: string
        }[]
      }
      customer_appointments: {
        Args: { p_session_token: string }
        Returns: {
          cancellation_reason: string
          customer_note: string
          ends_at: string
          id: string
          price_pence: number
          reference: string
          rejection_reason: string
          rescheduled_from: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      customer_cancel_appointment: {
        Args: {
          p_appointment_id: string
          p_reason?: string
          p_session_token: string
        }
        Returns: Database["public"]["Enums"]["appointment_status"]
      }
      customer_from_session: {
        Args: { p_session_token: string }
        Returns: string
      }
      customer_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_starts_at: string
          p_session_token: string
        }
        Returns: {
          appointment_id: string
          reference: string
        }[]
      }
      daily_close_summary: { Args: never; Returns: Json }
      decline_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      delete_appointment_as_owner: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      delete_customer_as_owner: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      drain_email_queue: { Args: never; Returns: number }
      erase_customer_as_owner: {
        Args: { p_customer_id: string }
        Returns: string
      }
      expire_pending_approvals: { Args: never; Returns: number }
      extend_weekly_template: { Args: never; Returns: number }
      generate_booking_reference: { Args: never; Returns: string }
      get_own_login_slug: { Args: never; Returns: string }
      hair_appointment: {
        Args: never
        Returns: {
          archived_at: string | null
          buffer_min: number
          category_id: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          price_pence: number
          slug: string
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "services"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_owner: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor?: string
          p_entity_id: string | null
          p_entity_type: string
          p_new_value?: Json | null
          p_old_value?: Json | null
          p_summary: string
        }
        Returns: string
      }
      log_payment: {
        Args: {
          p_amount_pence: number
          p_appointment_id: string
          p_note?: string
        }
        Returns: string
      }
      month_slot_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          booked_count: number
          on_date: string
          slot_count: number
        }[]
      }
      offer_slot_to_request: {
        Args: {
          p_override_reason?: string
          p_request_id: string
          p_starts_at: string
        }
        Returns: {
          appointment_id: string
          reference: string
        }[]
      }
      open_requests_in_order: {
        Args: never
        Returns: {
          created_at: string
          email: string
          flexibility: string
          full_name: string
          id: string
          mobile: string
          notes: string
          owner_response: string
          preferred_dates: string[]
          preferred_times: string
          queue_position: number
          service_id: string
          service_name: string
          status: Database["public"]["Enums"]["availability_request_status"]
          waiting_hours: number
        }[]
      }
      owner_dashboard_summary: { Args: never; Returns: Json }
      owner_day_slots: {
        Args: { p_date: string }
        Returns: {
          customer_name: string
          is_booked: boolean
          is_past: boolean
          local_time: string
          reference: string
          starts_at: string
        }[]
      }
      public_reviews: { Args: { p_limit?: number }; Returns: Json }
      public_service_menu: { Args: never; Returns: Json }
      purge_expired_access_tokens: { Args: never; Returns: number }
      purge_expired_audit_events: { Args: never; Returns: Json }
      purge_expired_personal_data: { Args: never; Returns: Json }
      queue_email: {
        Args: {
          p_appointment_id?: string
          p_customer_id?: string
          p_payload?: Json
          p_scheduled_for?: string
          p_subject: string
          p_template: string
          p_to_email: string
        }
        Returns: string
      }
      redeem_access_token: { Args: { p_token: string }; Returns: Json }
      reject_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          approval_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          ends_at: string
          id: string
          owner_note: string | null
          price_pence: number
          reference: string
          rejected_at: string | null
          rejection_reason: string | null
          requires_approval: boolean
          rescheduled_from: string | null
          review_requested_at: string | null
          service_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_day_slot: {
        Args: { p_date: string; p_time: string }
        Returns: boolean
      }
      reschedule_appointment_as_owner: {
        Args: { p_appointment_id: string; p_new_starts_at: string }
        Returns: {
          appointment_id: string
          reference: string
        }[]
      }
      retired_booking_templates: { Args: never; Returns: string[] }
      revoke_calendar_feed: { Args: { p_id: string }; Returns: undefined }
      send_custom_email_as_owner: {
        Args: {
          p_body: string
          p_customer_email: string
          p_customer_name: string
          p_subject: string
        }
        Returns: string
      }
      set_appointment_status: {
        Args: {
          p_appointment_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: {
          approval_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          ends_at: string
          id: string
          owner_note: string | null
          price_pence: number
          reference: string
          rejected_at: string | null
          rejection_reason: string | null
          requires_approval: boolean
          rescheduled_from: string | null
          review_requested_at: string | null
          service_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_day_slots: {
        Args: { p_date: string; p_times: string[] }
        Returns: number
      }
      set_owner_login_slug: { Args: { p_slug: string }; Returns: undefined }
      set_request_owner_note: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      set_weekly_template: {
        Args: { p_day_of_week: number; p_times: string[] }
        Returns: number
      }
      submit_contact_message: {
        Args: { p_email: string; p_full_name: string; p_message: string }
        Returns: undefined
      }
      subscribe_to_updates: {
        Args: { p_email: string; p_full_name?: string; p_source?: string }
        Returns: undefined
      }
      sync_google_reviews: { Args: never; Returns: number }
      system_health_summary: { Args: never; Returns: Json }
      weekly_template_status: { Args: never; Returns: Json }
    }
    Enums: {
      appointment_status:
        | "pending_approval"
        | "confirmed"
        | "checked_in"
        | "in_service"
        | "completed"
        | "cancelled"
        | "rejected"
        | "rescheduled"
        | "no_show"
      availability_request_status:
        | "new"
        | "awaiting_response"
        | "offer_sent"
        | "converted"
        | "declined"
        | "expired"
      email_status:
        | "queued"
        | "sending"
        | "sent"
        | "cancelled"
        | "failed"
        | "bounced"
      exception_kind: "closure" | "extra_hours" | "break"
      recommendation_status: "pending" | "accepted" | "dismissed" | "expired"
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
      appointment_status: [
        "pending_approval",
        "confirmed",
        "checked_in",
        "in_service",
        "completed",
        "cancelled",
        "rejected",
        "rescheduled",
        "no_show",
      ],
      availability_request_status: [
        "new",
        "awaiting_response",
        "offer_sent",
        "converted",
        "declined",
        "expired",
      ],
      email_status: [
        "queued",
        "sending",
        "sent",
        "cancelled",
        "failed",
        "bounced",
      ],
      exception_kind: ["closure", "extra_hours", "break"],
      recommendation_status: ["pending", "accepted", "dismissed", "expired"],
    },
  },
} as const
