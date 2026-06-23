export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          booking_id: string;
          class_id: string;
          created_at: string;
          id: string;
          marked_at: string | null;
          marked_by: string | null;
          member_id: string;
          status: string;
        };
        Insert: {
          booking_id: string;
          class_id: string;
          created_at?: string;
          id?: string;
          marked_at?: string | null;
          marked_by?: string | null;
          member_id: string;
          status?: string;
        };
        Update: {
          booking_id?: string;
          class_id?: string;
          created_at?: string;
          id?: string;
          marked_at?: string | null;
          marked_by?: string | null;
          member_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          class_id: string;
          created_at: string;
          credit_cost: number;
          id: string;
          member_id: string;
          status: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          credit_cost?: number;
          id?: string;
          member_id: string;
          status?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          credit_cost?: number;
          id?: string;
          member_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      class_templates: {
        Row: {
          active: boolean;
          created_at: string;
          default_cancellation_window_hours: number;
          default_capacity: number;
          default_credit_cost: number;
          default_duration_minutes: number;
          default_energy: string;
          default_instructor_id: string | null;
          default_room: string;
          id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          default_cancellation_window_hours?: number;
          default_capacity?: number;
          default_credit_cost?: number;
          default_duration_minutes?: number;
          default_energy?: string;
          default_instructor_id?: string | null;
          default_room?: string;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          default_cancellation_window_hours?: number;
          default_capacity?: number;
          default_credit_cost?: number;
          default_duration_minutes?: number;
          default_energy?: string;
          default_instructor_id?: string | null;
          default_room?: string;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_templates_default_instructor_id_fkey";
            columns: ["default_instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructors";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          booked_count: number;
          cancellation_window_hours: number;
          capacity: number;
          capacity_override: number | null;
          created_at: string;
          credit_cost: number;
          duration_minutes: number;
          energy: string;
          id: string;
          image_card_url: string | null;
          image_hero_url: string | null;
          image_thumb_url: string | null;
          image_url: string | null;
          instructor_id: string | null;
          price_override: number | null;
          program_type_id: string | null;
          room: string;
          room_id: string | null;
          starts_at: string;
          status: string;
          title: string;
          waitlist_count: number;
        };
        Insert: {
          booked_count?: number;
          cancellation_window_hours?: number;
          capacity: number;
          capacity_override?: number | null;
          created_at?: string;
          credit_cost?: number;
          duration_minutes?: number;
          energy: string;
          id?: string;
          image_card_url?: string | null;
          image_hero_url?: string | null;
          image_thumb_url?: string | null;
          image_url?: string | null;
          instructor_id?: string | null;
          price_override?: number | null;
          program_type_id?: string | null;
          room: string;
          room_id?: string | null;
          starts_at: string;
          status?: string;
          title: string;
          waitlist_count?: number;
        };
        Update: {
          booked_count?: number;
          cancellation_window_hours?: number;
          capacity?: number;
          capacity_override?: number | null;
          created_at?: string;
          credit_cost?: number;
          duration_minutes?: number;
          energy?: string;
          id?: string;
          image_card_url?: string | null;
          image_hero_url?: string | null;
          image_thumb_url?: string | null;
          image_url?: string | null;
          instructor_id?: string | null;
          price_override?: number | null;
          program_type_id?: string | null;
          room?: string;
          room_id?: string | null;
          starts_at?: string;
          status?: string;
          title?: string;
          waitlist_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey";
            columns: ["instructor_id"];
            isOneToOne: false;
            referencedRelation: "instructors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_program_type_id_fkey";
            columns: ["program_type_id"];
            isOneToOne: false;
            referencedRelation: "program_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_transactions: {
        Row: {
          amount_delta: number;
          created_at: string;
          created_by: string | null;
          id: string;
          member_id: string;
          reason: string;
          related_booking_id: string | null;
        };
        Insert: {
          amount_delta: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          member_id: string;
          reason: string;
          related_booking_id?: string | null;
        };
        Update: {
          amount_delta?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          member_id?: string;
          reason?: string;
          related_booking_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credit_transactions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      instructors: {
        Row: {
          active: boolean;
          avatar_url: string | null;
          bio_short: string | null;
          created_at: string;
          id: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          avatar_url?: string | null;
          bio_short?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          avatar_url?: string | null;
          bio_short?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          caption: string | null;
          created_at: string;
          entity_id: string | null;
          height: number | null;
          id: string;
          kind: string;
          public_url: string;
          storage_path: string;
          uploaded_by: string | null;
          width: number | null;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          entity_id?: string | null;
          height?: number | null;
          id?: string;
          kind: string;
          public_url: string;
          storage_path: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          entity_id?: string | null;
          height?: number | null;
          id?: string;
          kind?: string;
          public_url?: string;
          storage_path?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Relationships: [];
      };
      member_notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          important: boolean;
          member_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          important?: boolean;
          member_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          important?: boolean;
          member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_notes_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_plans: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          credits_granted: number;
          expires_at: string | null;
          id: string;
          member_id: string;
          notes: string | null;
          plan_id: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          credits_granted?: number;
          expires_at?: string | null;
          id?: string;
          member_id: string;
          notes?: string | null;
          plan_id: string;
          starts_at?: string;
          status?: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          credits_granted?: number;
          expires_at?: string | null;
          id?: string;
          member_id?: string;
          notes?: string | null;
          plan_id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_plans_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          attendance_count: number;
          care_notes: string | null;
          created_at: string;
          email: string | null;
          emergency_contact: string | null;
          energy_preference: string | null;
          id: string;
          last_visit_at: string | null;
          name: string;
          phone: string | null;
          preferred_language: string;
          remaining_credits: number;
          status: string;
          tags: string[];
        };
        Insert: {
          attendance_count?: number;
          care_notes?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact?: string | null;
          energy_preference?: string | null;
          id: string;
          last_visit_at?: string | null;
          name?: string;
          phone?: string | null;
          preferred_language?: string;
          remaining_credits?: number;
          status?: string;
          tags?: string[];
        };
        Update: {
          attendance_count?: number;
          care_notes?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact?: string | null;
          energy_preference?: string | null;
          id?: string;
          last_visit_at?: string | null;
          name?: string;
          phone?: string | null;
          preferred_language?: string;
          remaining_credits?: number;
          status?: string;
          tags?: string[];
        };
        Relationships: [];
      };
      notification_logs: {
        Row: {
          channel: string;
          created_at: string;
          generated_text: string | null;
          id: string;
          marked_sent_at: string | null;
          payload: Json;
          recipient_member_id: string | null;
          related_booking_id: string | null;
          related_class_id: string | null;
          related_member_plan_id: string | null;
          sent_by: string | null;
          status: string;
          subject: string | null;
          template_id: string | null;
          template_key: string | null;
          trigger_type: string | null;
        };
        Insert: {
          channel: string;
          created_at?: string;
          generated_text?: string | null;
          id?: string;
          marked_sent_at?: string | null;
          payload?: Json;
          recipient_member_id?: string | null;
          related_booking_id?: string | null;
          related_class_id?: string | null;
          related_member_plan_id?: string | null;
          sent_by?: string | null;
          status?: string;
          subject?: string | null;
          template_id?: string | null;
          template_key?: string | null;
          trigger_type?: string | null;
        };
        Update: {
          channel?: string;
          created_at?: string;
          generated_text?: string | null;
          id?: string;
          marked_sent_at?: string | null;
          payload?: Json;
          recipient_member_id?: string | null;
          related_booking_id?: string | null;
          related_class_id?: string | null;
          related_member_plan_id?: string | null;
          sent_by?: string | null;
          status?: string;
          subject?: string | null;
          template_id?: string | null;
          template_key?: string | null;
          trigger_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_logs_recipient_member_id_fkey";
            columns: ["recipient_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_related_booking_id_fkey";
            columns: ["related_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_related_class_id_fkey";
            columns: ["related_class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_related_member_plan_id_fkey";
            columns: ["related_member_plan_id"];
            isOneToOne: false;
            referencedRelation: "member_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "notification_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_templates: {
        Row: {
          active: boolean;
          body: string;
          channel: string;
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          label: string;
          language: string;
          subject: string | null;
          trigger_type: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          channel: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          key: string;
          label: string;
          language?: string;
          subject?: string | null;
          trigger_type?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          channel?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          label?: string;
          language?: string;
          subject?: string | null;
          trigger_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      package_requests: {
        Row: {
          admin_notes: string | null;
          created_at: string;
          id: string;
          member_id: string;
          message_text: string | null;
          plan_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          created_at?: string;
          id?: string;
          member_id: string;
          message_text?: string | null;
          plan_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          created_at?: string;
          id?: string;
          member_id?: string;
          message_text?: string | null;
          plan_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_requests_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "package_requests_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          confirmed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          member_id: string;
          member_plan_id: string | null;
          metadata: Json;
          method: string;
          notes: string | null;
          paid_at: string;
          plan_id: string | null;
          provider: string;
          provider_customer_id: string | null;
          provider_payment_id: string | null;
          provider_session_id: string | null;
          provider_status: string | null;
          receipt_url: string | null;
          recorded_by: string | null;
          reference: string | null;
          refunded_amount: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          member_id: string;
          member_plan_id?: string | null;
          metadata?: Json;
          method: string;
          notes?: string | null;
          paid_at?: string;
          plan_id?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          provider_payment_id?: string | null;
          provider_session_id?: string | null;
          provider_status?: string | null;
          receipt_url?: string | null;
          recorded_by?: string | null;
          reference?: string | null;
          refunded_amount?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          member_id?: string;
          member_plan_id?: string | null;
          metadata?: Json;
          method?: string;
          notes?: string | null;
          paid_at?: string;
          plan_id?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          provider_payment_id?: string | null;
          provider_session_id?: string | null;
          provider_status?: string | null;
          receipt_url?: string | null;
          recorded_by?: string | null;
          reference?: string | null;
          refunded_amount?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_member_plan_id_fkey";
            columns: ["member_plan_id"];
            isOneToOne: false;
            referencedRelation: "member_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          created_at: string;
          credits: number;
          currency: string;
          description: string | null;
          duration_days: number | null;
          id: string;
          name: string;
          price_cents: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          credits?: number;
          currency?: string;
          description?: string | null;
          duration_days?: number | null;
          id?: string;
          name: string;
          price_cents?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          credits?: number;
          currency?: string;
          description?: string | null;
          duration_days?: number | null;
          id?: string;
          name?: string;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          created_at?: string;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      program_types: {
        Row: {
          active: boolean;
          age_groups: string[];
          color_tag: string;
          cover_image_url: string | null;
          created_at: string;
          default_capacity: number;
          default_credit_cost: number;
          default_duration_minutes: number;
          description_ar: string | null;
          description_en: string | null;
          description_he: string | null;
          equipment: string[];
          id: string;
          image_card_url: string | null;
          image_hero_url: string | null;
          image_thumb_url: string | null;
          image_url: string | null;
          level: string | null;
          name_ar: string;
          name_en: string;
          name_he: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          age_groups?: string[];
          color_tag?: string;
          cover_image_url?: string | null;
          created_at?: string;
          default_capacity?: number;
          default_credit_cost?: number;
          default_duration_minutes?: number;
          description_ar?: string | null;
          description_en?: string | null;
          description_he?: string | null;
          equipment?: string[];
          id?: string;
          image_card_url?: string | null;
          image_hero_url?: string | null;
          image_thumb_url?: string | null;
          image_url?: string | null;
          level?: string | null;
          name_ar: string;
          name_en: string;
          name_he: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          age_groups?: string[];
          color_tag?: string;
          cover_image_url?: string | null;
          created_at?: string;
          default_capacity?: number;
          default_credit_cost?: number;
          default_duration_minutes?: number;
          description_ar?: string | null;
          description_en?: string | null;
          description_he?: string | null;
          equipment?: string[];
          id?: string;
          image_card_url?: string | null;
          image_hero_url?: string | null;
          image_thumb_url?: string | null;
          image_url?: string | null;
          level?: string | null;
          name_ar?: string;
          name_en?: string;
          name_he?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_events: {
        Row: {
          error_message: string | null;
          event_id: string;
          event_type: string | null;
          id: string;
          payload: Json;
          payment_id: string | null;
          processed_at: string | null;
          processing_status: string;
          provider: string;
          received_at: string;
        };
        Insert: {
          error_message?: string | null;
          event_id: string;
          event_type?: string | null;
          id?: string;
          payload?: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          processing_status?: string;
          provider: string;
          received_at?: string;
        };
        Update: {
          error_message?: string | null;
          event_id?: string;
          event_type?: string | null;
          id?: string;
          payload?: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          processing_status?: string;
          provider?: string;
          received_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      receipts: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          external_doc_id: string | null;
          external_doc_url: string | null;
          external_provider: string | null;
          footer_note: string | null;
          id: string;
          issued_at: string;
          member_id: string;
          member_name_snapshot: string | null;
          method_snapshot: string | null;
          payment_id: string;
          plan_name_snapshot: string | null;
          receipt_number: string;
          receipt_type: string;
          status: string;
          studio_name_snapshot: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          external_doc_id?: string | null;
          external_doc_url?: string | null;
          external_provider?: string | null;
          footer_note?: string | null;
          id?: string;
          issued_at?: string;
          member_id: string;
          member_name_snapshot?: string | null;
          method_snapshot?: string | null;
          payment_id: string;
          plan_name_snapshot?: string | null;
          receipt_number: string;
          receipt_type?: string;
          status?: string;
          studio_name_snapshot?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          external_doc_id?: string | null;
          external_doc_url?: string | null;
          external_provider?: string | null;
          footer_note?: string | null;
          id?: string;
          issued_at?: string;
          member_id?: string;
          member_name_snapshot?: string | null;
          method_snapshot?: string | null;
          payment_id?: string;
          plan_name_snapshot?: string | null;
          receipt_number?: string;
          receipt_type?: string;
          status?: string;
          studio_name_snapshot?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: true;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_class_rules: {
        Row: {
          active: boolean;
          created_at: string;
          ends_on: string | null;
          id: string;
          start_time: string;
          starts_on: string;
          template_id: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          start_time: string;
          starts_on?: string;
          template_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          start_time?: string;
          starts_on?: string;
          template_id?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_class_rules_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "class_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          active: boolean;
          capacity: number;
          color: string;
          created_at: string;
          description: string | null;
          equipment_count: number;
          id: string;
          image_url: string | null;
          name: string;
          notes: string | null;
          setup_minutes_after: number;
          setup_minutes_before: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          capacity?: number;
          color?: string;
          created_at?: string;
          description?: string | null;
          equipment_count?: number;
          id?: string;
          image_url?: string | null;
          name: string;
          notes?: string | null;
          setup_minutes_after?: number;
          setup_minutes_before?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          color?: string;
          created_at?: string;
          description?: string | null;
          equipment_count?: number;
          id?: string;
          image_url?: string | null;
          name?: string;
          notes?: string | null;
          setup_minutes_after?: number;
          setup_minutes_before?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_settings: {
        Row: {
          address: string | null;
          allow_waitlist: boolean;
          announcement_text: string | null;
          auto_promote_waitlist: boolean;
          booking_window_days: number;
          contact_email: string | null;
          currency: string;
          default_cancellation_window_hours: number;
          default_capacity: number;
          default_credit_cost: number;
          default_language: string;
          email_enabled: boolean;
          energy_labels: string[];
          fallback_image_url: string | null;
          hero_image_url: string | null;
          id: number;
          instagram_url: string | null;
          invoice_provider: string;
          login_image_url: string | null;
          logo_url: string | null;
          payments_cancel_url: string | null;
          payments_enabled: boolean;
          payments_mode: string;
          payments_provider: string;
          payments_success_url: string | null;
          public_phone: string | null;
          receipt_footer_note: string | null;
          receipt_prefix: string;
          registration_closes_minutes: number;
          rooms: string[];
          studio_atmosphere_url: string | null;
          studio_name: string;
          supported_languages: string[];
          timezone: string;
          trial_class_allowed: boolean;
          updated_at: string;
          waitlist_claim_window_minutes: number;
          website_url: string | null;
          welcome_text: string | null;
          whatsapp_enabled: boolean;
          whatsapp_number: string | null;
        };
        Insert: {
          address?: string | null;
          allow_waitlist?: boolean;
          announcement_text?: string | null;
          auto_promote_waitlist?: boolean;
          booking_window_days?: number;
          contact_email?: string | null;
          currency?: string;
          default_cancellation_window_hours?: number;
          default_capacity?: number;
          default_credit_cost?: number;
          default_language?: string;
          email_enabled?: boolean;
          energy_labels?: string[];
          fallback_image_url?: string | null;
          hero_image_url?: string | null;
          id?: number;
          instagram_url?: string | null;
          invoice_provider?: string;
          login_image_url?: string | null;
          logo_url?: string | null;
          payments_cancel_url?: string | null;
          payments_enabled?: boolean;
          payments_mode?: string;
          payments_provider?: string;
          payments_success_url?: string | null;
          public_phone?: string | null;
          receipt_footer_note?: string | null;
          receipt_prefix?: string;
          registration_closes_minutes?: number;
          rooms?: string[];
          studio_atmosphere_url?: string | null;
          studio_name?: string;
          supported_languages?: string[];
          timezone?: string;
          trial_class_allowed?: boolean;
          updated_at?: string;
          waitlist_claim_window_minutes?: number;
          website_url?: string | null;
          welcome_text?: string | null;
          whatsapp_enabled?: boolean;
          whatsapp_number?: string | null;
        };
        Update: {
          address?: string | null;
          allow_waitlist?: boolean;
          announcement_text?: string | null;
          auto_promote_waitlist?: boolean;
          booking_window_days?: number;
          contact_email?: string | null;
          currency?: string;
          default_cancellation_window_hours?: number;
          default_capacity?: number;
          default_credit_cost?: number;
          default_language?: string;
          email_enabled?: boolean;
          energy_labels?: string[];
          fallback_image_url?: string | null;
          hero_image_url?: string | null;
          id?: number;
          instagram_url?: string | null;
          invoice_provider?: string;
          login_image_url?: string | null;
          logo_url?: string | null;
          payments_cancel_url?: string | null;
          payments_enabled?: boolean;
          payments_mode?: string;
          payments_provider?: string;
          payments_success_url?: string | null;
          public_phone?: string | null;
          receipt_footer_note?: string | null;
          receipt_prefix?: string;
          registration_closes_minutes?: number;
          rooms?: string[];
          studio_atmosphere_url?: string | null;
          studio_name?: string;
          supported_languages?: string[];
          timezone?: string;
          trial_class_allowed?: boolean;
          updated_at?: string;
          waitlist_claim_window_minutes?: number;
          website_url?: string | null;
          welcome_text?: string | null;
          whatsapp_enabled?: boolean;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          member_id: string;
          promoted_at: string | null;
          status: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
          promoted_at?: string | null;
          status?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
          promoted_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _log_action_as: {
        Args: {
          _action: string;
          _actor_id: string;
          _entity_id: string;
          _entity_type: string;
          _metadata?: Json;
        };
        Returns: undefined;
      };
      admin_adjust_credits: {
        Args: {
          p_actor_id: string;
          p_delta: number;
          p_member_id: string;
          p_override?: boolean;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_assign_plan: {
        Args: {
          p_actor_id: string;
          p_member_id: string;
          p_notes?: string;
          p_plan_id: string;
        };
        Returns: Json;
      };
      admin_cancel_booking: {
        Args: { p_actor_id: string; p_booking_id: string; p_refund?: boolean };
        Returns: Json;
      };
      admin_create_booking: {
        Args: {
          p_actor_id: string;
          p_class_id: string;
          p_member_id: string;
          p_override?: boolean;
        };
        Returns: Json;
      };
      admin_generate_class_from_template: {
        Args: { p_actor_id: string; p_start_at: string; p_template_id: string };
        Returns: Json;
      };
      admin_waitlist_offer: {
        Args: { p_actor_id: string; p_entry_id: string };
        Returns: Json;
      };
      admin_waitlist_promote: {
        Args: { p_actor_id: string; p_entry_id: string };
        Returns: Json;
      };
      book_class_v2: {
        Args: { p_actor_id: string; p_class_id: string };
        Returns: Json;
      };
      confirm_payment_and_issue_receipt: {
        Args: {
          p_actor_id: string;
          p_metadata?: Json;
          p_payment_id: string;
          p_provider_payment_id?: string;
          p_provider_session_id?: string;
          p_provider_status?: string;
          p_receipt_url?: string;
        };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      mark_attendance_v2: {
        Args: { p_actor_id: string; p_booking_id: string; p_status: string };
        Returns: Json;
      };
      member_cancel_booking: {
        Args: { p_actor_id: string; p_booking_id: string };
        Returns: Json;
      };
      member_join_waitlist: {
        Args: { p_actor_id: string; p_class_id: string };
        Returns: Json;
      };
      member_leave_waitlist: {
        Args: { p_actor_id: string; p_entry_id: string };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "member" | "instructor" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "instructor", "admin"],
    },
  },
} as const;
