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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      abandoned_checkouts: {
        Row: {
          context: Json | null
          created_at: string
          email: string
          expired_at: string
          id: string
          lock_id: string | null
          recovery_email_sent_at: string | null
          service: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          email: string
          expired_at?: string
          id?: string
          lock_id?: string | null
          recovery_email_sent_at?: string | null
          service: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          email?: string
          expired_at?: string
          id?: string
          lock_id?: string | null
          recovery_email_sent_at?: string | null
          service?: string
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          cancellation_token: string
          created_at: string
          id: string
          processed_at: string | null
          reason: string | null
          scheduled_for: string
          status: string
          user_email: string
          user_id: string
        }
        Insert: {
          cancellation_token?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          scheduled_for?: string
          status?: string
          user_email: string
          user_id: string
        }
        Update: {
          cancellation_token?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          scheduled_for?: string
          status?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_2fa: {
        Row: {
          created_at: string
          enabled: boolean
          enrolled_at: string | null
          id: string
          last_verified_at: string | null
          recovery_codes: Json
          secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          enrolled_at?: string | null
          id?: string
          last_verified_at?: string | null
          recovery_codes?: Json
          secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          enrolled_at?: string | null
          id?: string
          last_verified_at?: string | null
          recovery_codes?: Json
          secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      backdrops: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          room_title: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          room_title?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          room_title?: string | null
        }
        Relationships: []
      }
      booking_blocklist: {
        Row: {
          blocked_by: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          internal_note: string | null
          phone: string | null
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_note?: string | null
          phone?: string | null
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_note?: string | null
          phone?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      booking_followups: {
        Row: {
          booking_id: string
          followup_sent_at: string
          id: string
        }
        Insert: {
          booking_id: string
          followup_sent_at?: string
          id?: string
        }
        Update: {
          booking_id?: string
          followup_sent_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_followups_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reminders: {
        Row: {
          booking_id: string
          id: string
          reminder_sent_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          reminder_sent_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          reminder_sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reminders_2h: {
        Row: {
          booking_id: string
          id: string
          reminder_sent_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          reminder_sent_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          reminder_sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminders_2h_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tab_images: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_tab_type"]
          bytes: number | null
          created_at: string
          display_order: number
          height: number | null
          id: string
          is_active: boolean
          mime_type: string | null
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          booking_type: Database["public"]["Enums"]["booking_tab_type"]
          bytes?: number | null
          created_at?: string
          display_order?: number
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_tab_type"]
          bytes?: number | null
          created_at?: string
          display_order?: number
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      booking_tab_layout: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_tab_type"]
          id: string
          layout_variant: Database["public"]["Enums"]["booking_tab_layout_variant"]
          updated_at: string
        }
        Insert: {
          booking_type: Database["public"]["Enums"]["booking_tab_type"]
          id?: string
          layout_variant?: Database["public"]["Enums"]["booking_tab_layout_variant"]
          updated_at?: string
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_tab_type"]
          id?: string
          layout_variant?: Database["public"]["Enums"]["booking_tab_layout_variant"]
          updated_at?: string
        }
        Relationships: []
      }
      booking_tabs_meta: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_tab_type"]
          coming_soon: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          price: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          booking_type: Database["public"]["Enums"]["booking_tab_type"]
          coming_soon?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          price?: string
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_tab_type"]
          coming_soon?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          price?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address_revealed: boolean
          amount_cents: number
          backdrop: string | null
          booking_date: string
          booking_time: string
          cancellation_reason: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          confirmation_sent: boolean
          consent_accepted: boolean
          consent_accepted_at: string | null
          consent_signature_path: string | null
          consent_signed_at: string | null
          consent_signer_name: string | null
          consent_version: string | null
          created_at: string
          custom_requests: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          decline_reason: string | null
          equipment: Json | null
          id: string
          id_photo_url: string | null
          id_verified: string | null
          layout: string | null
          lighting: string | null
          payment_status: string
          referrer_url: string | null
          refund_status: string | null
          refunded_amount_cents: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          room_title: string
          screening_review_deadline: string | null
          screening_status: string | null
          sound: string | null
          staff_check_in_note: string | null
          stripe_session_id: string | null
          tier: string | null
          user_age_tier: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          verification_held_until: string | null
          verification_status: string
        }
        Insert: {
          address_revealed?: boolean
          amount_cents: number
          backdrop?: string | null
          booking_date: string
          booking_time: string
          cancellation_reason?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmation_sent?: boolean
          consent_accepted?: boolean
          consent_accepted_at?: string | null
          consent_signature_path?: string | null
          consent_signed_at?: string | null
          consent_signer_name?: string | null
          consent_version?: string | null
          created_at?: string
          custom_requests?: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          decline_reason?: string | null
          equipment?: Json | null
          id?: string
          id_photo_url?: string | null
          id_verified?: string | null
          layout?: string | null
          lighting?: string | null
          payment_status?: string
          referrer_url?: string | null
          refund_status?: string | null
          refunded_amount_cents?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_title: string
          screening_review_deadline?: string | null
          screening_status?: string | null
          sound?: string | null
          staff_check_in_note?: string | null
          stripe_session_id?: string | null
          tier?: string | null
          user_age_tier?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          verification_held_until?: string | null
          verification_status?: string
        }
        Update: {
          address_revealed?: boolean
          amount_cents?: number
          backdrop?: string | null
          booking_date?: string
          booking_time?: string
          cancellation_reason?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmation_sent?: boolean
          consent_accepted?: boolean
          consent_accepted_at?: string | null
          consent_signature_path?: string | null
          consent_signed_at?: string | null
          consent_signer_name?: string | null
          consent_version?: string | null
          created_at?: string
          custom_requests?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          decline_reason?: string | null
          equipment?: Json | null
          id?: string
          id_photo_url?: string | null
          id_verified?: string | null
          layout?: string | null
          lighting?: string | null
          payment_status?: string
          referrer_url?: string | null
          refund_status?: string | null
          refunded_amount_cents?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_title?: string
          screening_review_deadline?: string | null
          screening_status?: string | null
          sound?: string | null
          staff_check_in_note?: string | null
          stripe_session_id?: string | null
          tier?: string | null
          user_age_tier?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          verification_held_until?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      challenge_entries: {
        Row: {
          audio_url: string
          challenge_id: string
          created_at: string
          dj_name: string
          id: string
          user_id: string
          vote_count: number
        }
        Insert: {
          audio_url: string
          challenge_id: string
          created_at?: string
          dj_name: string
          id?: string
          user_id: string
          vote_count?: number
        }
        Update: {
          audio_url?: string
          challenge_id?: string
          created_at?: string
          dj_name?: string
          id?: string
          user_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_votes: {
        Row: {
          challenge_id: string
          created_at: string
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          entry_id: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_votes_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_votes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "challenge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          id: string
          prize_description: string
          starts_at: string
          status: string
          theme: string
          title: string
          voting_ends_at: string
          winner_entry_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          ends_at: string
          id?: string
          prize_description?: string
          starts_at: string
          status?: string
          theme: string
          title: string
          voting_ends_at: string
          winner_entry_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          prize_description?: string
          starts_at?: string
          status?: string
          theme?: string
          title?: string
          voting_ends_at?: string
          winner_entry_id?: string | null
        }
        Relationships: []
      }
      client_intake: {
        Row: {
          agreed_at: string
          agreed_cancellation: boolean
          agreed_code_of_conduct: boolean
          agreed_liability: boolean
          agreed_policies: boolean
          agreement_ip: string | null
          agreement_user_agent: string | null
          attendee_count: number
          attendee_names: string | null
          booking_id: string
          created_at: string
          id: string
          purpose: string
          referral_source: string | null
          status_token: string
        }
        Insert: {
          agreed_at?: string
          agreed_cancellation?: boolean
          agreed_code_of_conduct?: boolean
          agreed_liability?: boolean
          agreed_policies?: boolean
          agreement_ip?: string | null
          agreement_user_agent?: string | null
          attendee_count?: number
          attendee_names?: string | null
          booking_id: string
          created_at?: string
          id?: string
          purpose: string
          referral_source?: string | null
          status_token?: string
        }
        Update: {
          agreed_at?: string
          agreed_cancellation?: boolean
          agreed_code_of_conduct?: boolean
          agreed_liability?: boolean
          agreed_policies?: boolean
          agreement_ip?: string | null
          agreement_user_agent?: string | null
          attendee_count?: number
          attendee_names?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          purpose?: string
          referral_source?: string | null
          status_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_intake_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_equipment_items: {
        Row: {
          bookable: boolean
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          hourly_price_cents: number | null
          id: string
          image_url: string | null
          name: string
          price_cents: number
          price_label: string | null
          quantity_available: number
          sort_order: number
          updated_at: string
          weekly_price_cents: number | null
        }
        Insert: {
          bookable?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hourly_price_cents?: number | null
          id?: string
          image_url?: string | null
          name: string
          price_cents?: number
          price_label?: string | null
          quantity_available?: number
          sort_order?: number
          updated_at?: string
          weekly_price_cents?: number | null
        }
        Update: {
          bookable?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hourly_price_cents?: number | null
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          price_label?: string | null
          quantity_available?: number
          sort_order?: number
          updated_at?: string
          weekly_price_cents?: number | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          amount_cents: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          redeemed: boolean
          redeemed_at: string | null
          redeemed_by_booking_id: string | null
          redeemed_by_email: string | null
          token: string
        }
        Insert: {
          amount_cents?: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by_booking_id?: string | null
          redeemed_by_email?: string | null
          token: string
        }
        Update: {
          amount_cents?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by_booking_id?: string | null
          redeemed_by_email?: string | null
          token?: string
        }
        Relationships: []
      }
      edge_function_metrics: {
        Row: {
          created_at: string
          error_4xx: number
          error_5xx: number
          function_name: string
          id: string
          metric_date: string
          p95_ms: number | null
          total_calls: number
        }
        Insert: {
          created_at?: string
          error_4xx?: number
          error_5xx?: number
          function_name: string
          id?: string
          metric_date?: string
          p95_ms?: number | null
          total_calls?: number
        }
        Update: {
          created_at?: string
          error_4xx?: number
          error_5xx?: number
          function_name?: string
          id?: string
          metric_date?: string
          p95_ms?: number | null
          total_calls?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      equipment_block_events: {
        Row: {
          block_direction: string
          blocked_date: string | null
          created_at: string
          equipment_name: string
          id: string
          service: string
          user_email: string | null
        }
        Insert: {
          block_direction: string
          blocked_date?: string | null
          created_at?: string
          equipment_name: string
          id?: string
          service: string
          user_email?: string | null
        }
        Update: {
          block_direction?: string
          blocked_date?: string | null
          created_at?: string
          equipment_name?: string
          id?: string
          service?: string
          user_email?: string | null
        }
        Relationships: []
      }
      equipment_locks: {
        Row: {
          created_at: string
          equipment_name: string
          expires_at: string
          id: string
          locked_by_email: string
          pickup_date: string
          rental_days: number
        }
        Insert: {
          created_at?: string
          equipment_name: string
          expires_at: string
          id?: string
          locked_by_email: string
          pickup_date: string
          rental_days?: number
        }
        Update: {
          created_at?: string
          equipment_name?: string
          expires_at?: string
          id?: string
          locked_by_email?: string
          pickup_date?: string
          rental_days?: number
        }
        Relationships: []
      }
      equipment_rentals: {
        Row: {
          amount_cents: number
          checked_in_at: string | null
          checked_in_by: string | null
          confirmation_sent: boolean
          consent_signature_path: string | null
          consent_signed_at: string | null
          consent_signer_name: string | null
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          items: Json
          payment_status: string
          pickup_date: string | null
          rental_days: number
          staff_check_in_note: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmation_sent?: boolean
          consent_signature_path?: string | null
          consent_signed_at?: string | null
          consent_signer_name?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          id?: string
          items?: Json
          payment_status?: string
          pickup_date?: string | null
          rental_days: number
          staff_check_in_note?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          checked_in_at?: string | null
          checked_in_by?: string | null
          confirmation_sent?: boolean
          consent_signature_path?: string | null
          consent_signed_at?: string | null
          consent_signer_name?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          items?: Json
          payment_status?: string
          pickup_date?: string | null
          rental_days?: number
          staff_check_in_note?: string | null
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      equipment_status: {
        Row: {
          equipment_name: string
          expected_available_at: string | null
          id: string
          is_available: boolean
          maintenance_note: string | null
          unavailable_since: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          equipment_name: string
          expected_available_at?: string | null
          id?: string
          is_available?: boolean
          maintenance_note?: string | null
          unavailable_since?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          equipment_name?: string
          expected_available_at?: string | null
          id?: string
          is_available?: boolean
          maintenance_note?: string | null
          unavailable_since?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      event_gallery: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_gallery_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_hosts: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          host_email: string | null
          host_name: string
          id: string
          last_accessed_at: string | null
          organization: string | null
          revoked: boolean
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          host_email?: string | null
          host_name: string
          id?: string
          last_accessed_at?: string | null
          organization?: string | null
          revoked?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          host_email?: string | null
          host_name?: string
          id?: string
          last_accessed_at?: string | null
          organization?: string | null
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_lineup: {
        Row: {
          bio: string | null
          created_at: string
          event_id: string
          id: string
          name: string
          photo_url: string | null
          role: string | null
          sort_order: number
        }
        Insert: {
          bio?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          photo_url?: string | null
          role?: string | null
          sort_order?: number
        }
        Update: {
          bio?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_lineup_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notify_signups: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          notified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          notified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_notify_signups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          id: string
          reminder_sent_at: string
          rsvp_id: string
        }
        Insert: {
          id?: string
          reminder_sent_at?: string
          rsvp_id: string
        }
        Update: {
          id?: string
          reminder_sent_at?: string
          rsvp_id?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          amount_paid_cents: number
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          event_id: string
          id: string
          payment_status: string
          promoted_from_waitlist_at: string | null
          referrer_url: string | null
          referring_host_id: string | null
          status: string
          stripe_session_id: string | null
          ticket_code: string | null
          ticket_tier_id: string | null
          updated_at: string
          user_email: string
          user_id: string | null
          user_name: string
          user_phone: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          waitlist_position: number | null
        }
        Insert: {
          amount_paid_cents?: number
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          payment_status?: string
          promoted_from_waitlist_at?: string | null
          referrer_url?: string | null
          referring_host_id?: string | null
          status?: string
          stripe_session_id?: string | null
          ticket_code?: string | null
          ticket_tier_id?: string | null
          updated_at?: string
          user_email: string
          user_id?: string | null
          user_name: string
          user_phone?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          waitlist_position?: number | null
        }
        Update: {
          amount_paid_cents?: number
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          payment_status?: string
          promoted_from_waitlist_at?: string | null
          referrer_url?: string | null
          referring_host_id?: string | null
          status?: string
          stripe_session_id?: string | null
          ticket_code?: string | null
          ticket_tier_id?: string | null
          updated_at?: string
          user_email?: string
          user_id?: string | null
          user_name?: string
          user_phone?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_ticket_tier_id_fkey"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_tiers: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          event_id: string
          id: string
          is_free: boolean
          name: string
          price_cents: number
          sold_out: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          is_free?: boolean
          name: string
          price_cents?: number
          sold_out?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          is_free?: boolean
          name?: string
          price_cents?: number
          sold_out?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlist_notifications: {
        Row: {
          claimed: boolean
          expires_at: string
          id: string
          notified_at: string
          rsvp_id: string
        }
        Insert: {
          claimed?: boolean
          expires_at?: string
          id?: string
          notified_at?: string
          rsvp_id: string
        }
        Update: {
          claimed?: boolean
          expires_at?: string
          id?: string
          notified_at?: string
          rsvp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlist_notifications_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "event_rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archived_at: string | null
          capacity: number
          card_style: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          is_free: boolean
          is_public_teaser: boolean
          location: string | null
          price_cents: number
          refund_policy: string | null
          room_title: string | null
          show_price: boolean
          slug: string | null
          sort_order: number
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          capacity?: number
          card_style?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          is_free?: boolean
          is_public_teaser?: boolean
          location?: string | null
          price_cents?: number
          refund_policy?: string | null
          room_title?: string | null
          show_price?: boolean
          slug?: string | null
          sort_order?: number
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          capacity?: number
          card_style?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_free?: boolean
          is_public_teaser?: boolean
          location?: string | null
          price_cents?: number
          refund_policy?: string | null
          room_title?: string | null
          show_price?: boolean
          slug?: string | null
          sort_order?: number
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      events_homepage_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      events_homepage_gallery: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: []
      }
      events_homepage_settings: {
        Row: {
          about_address: string | null
          about_body: string | null
          about_contact_email: string | null
          about_contact_phone: string | null
          about_heading: string
          about_hours: string | null
          about_show: boolean
          faq_heading: string
          faq_show: boolean
          hero_cta_link: string | null
          hero_cta_text: string | null
          hero_headline: string
          hero_media_type: string
          hero_media_url: string | null
          hero_overlay_opacity: number
          hero_subheadline: string
          id: number
          notify_button_text: string
          notify_description: string
          notify_heading: string
          notify_show: boolean
          notify_success_message: string
          past_heading: string
          past_show: boolean
          seo_description: string | null
          seo_og_description: string | null
          seo_og_image_url: string | null
          seo_og_title: string | null
          seo_title: string
          upcoming_heading: string
          upcoming_layout: string
          upcoming_limit: number | null
          upcoming_subheading: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          about_address?: string | null
          about_body?: string | null
          about_contact_email?: string | null
          about_contact_phone?: string | null
          about_heading?: string
          about_hours?: string | null
          about_show?: boolean
          faq_heading?: string
          faq_show?: boolean
          hero_cta_link?: string | null
          hero_cta_text?: string | null
          hero_headline?: string
          hero_media_type?: string
          hero_media_url?: string | null
          hero_overlay_opacity?: number
          hero_subheadline?: string
          id?: number
          notify_button_text?: string
          notify_description?: string
          notify_heading?: string
          notify_show?: boolean
          notify_success_message?: string
          past_heading?: string
          past_show?: boolean
          seo_description?: string | null
          seo_og_description?: string | null
          seo_og_image_url?: string | null
          seo_og_title?: string | null
          seo_title?: string
          upcoming_heading?: string
          upcoming_layout?: string
          upcoming_limit?: number | null
          upcoming_subheading?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          about_address?: string | null
          about_body?: string | null
          about_contact_email?: string | null
          about_contact_phone?: string | null
          about_heading?: string
          about_hours?: string | null
          about_show?: boolean
          faq_heading?: string
          faq_show?: boolean
          hero_cta_link?: string | null
          hero_cta_text?: string | null
          hero_headline?: string
          hero_media_type?: string
          hero_media_url?: string | null
          hero_overlay_opacity?: number
          hero_subheadline?: string
          id?: number
          notify_button_text?: string
          notify_description?: string
          notify_heading?: string
          notify_show?: boolean
          notify_success_message?: string
          past_heading?: string
          past_show?: boolean
          seo_description?: string | null
          seo_og_description?: string | null
          seo_og_image_url?: string | null
          seo_og_title?: string | null
          seo_title?: string
          upcoming_heading?: string
          upcoming_layout?: string
          upcoming_limit?: number | null
          upcoming_subheading?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      experiment_assignments: {
        Row: {
          conversion_value_cents: number | null
          converted_at: string | null
          created_at: string
          experiment_id: string
          experiment_key: string
          id: string
          subject_id: string
          variant: string
        }
        Insert: {
          conversion_value_cents?: number | null
          converted_at?: string | null
          created_at?: string
          experiment_id: string
          experiment_key: string
          id?: string
          subject_id: string
          variant: string
        }
        Update: {
          conversion_value_cents?: number | null
          converted_at?: string | null
          created_at?: string
          experiment_id?: string
          experiment_key?: string
          id?: string
          subject_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          key: string
          name: string
          starts_at: string | null
          status: string
          updated_at: string
          variants: Json
          weights: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          key: string
          name: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          variants?: Json
          weights?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          key?: string
          name?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          variants?: Json
          weights?: Json | null
        }
        Relationships: []
      }
      failure_reports: {
        Row: {
          amount_cents: number | null
          booking_date: string | null
          booking_id: string | null
          booking_time: string | null
          category: string | null
          console_log: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          digest_sent: boolean
          digest_sent_at: string | null
          error_message: string
          id: string
          network_log: string | null
          route: string | null
          service: string | null
          stage: string
          stripe_session_id: string | null
          user_agent: string | null
          viewport: string | null
        }
        Insert: {
          amount_cents?: number | null
          booking_date?: string | null
          booking_id?: string | null
          booking_time?: string | null
          category?: string | null
          console_log?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          digest_sent?: boolean
          digest_sent_at?: string | null
          error_message: string
          id?: string
          network_log?: string | null
          route?: string | null
          service?: string | null
          stage: string
          stripe_session_id?: string | null
          user_agent?: string | null
          viewport?: string | null
        }
        Update: {
          amount_cents?: number | null
          booking_date?: string | null
          booking_id?: string | null
          booking_time?: string | null
          category?: string | null
          console_log?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          digest_sent?: boolean
          digest_sent_at?: string | null
          error_message?: string
          id?: string
          network_log?: string | null
          route?: string | null
          service?: string | null
          stage?: string
          stripe_session_id?: string | null
          user_agent?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          amount_cents: number
          balance_cents: number
          code: string
          created_at: string
          id: string
          issued_by_admin: boolean
          payment_status: string
          personal_message: string | null
          purchaser_email: string | null
          purchaser_user_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          redeemed_at: string | null
          redeemed_by_booking_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          balance_cents: number
          code: string
          created_at?: string
          id?: string
          issued_by_admin?: boolean
          payment_status?: string
          personal_message?: string | null
          purchaser_email?: string | null
          purchaser_user_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          redeemed_at?: string | null
          redeemed_by_booking_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          balance_cents?: number
          code?: string
          created_at?: string
          id?: string
          issued_by_admin?: boolean
          payment_status?: string
          personal_message?: string | null
          purchaser_email?: string | null
          purchaser_user_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          redeemed_at?: string | null
          redeemed_by_booking_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_redeemed_by_booking_id_fkey"
            columns: ["redeemed_by_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_checkins: {
        Row: {
          booking_id: string
          checked_in_at: string
          checked_in_by: string
          guardian_id_matched: boolean
          id: string
          notes: string | null
          verification_id: string
        }
        Insert: {
          booking_id: string
          checked_in_at?: string
          checked_in_by: string
          guardian_id_matched: boolean
          id?: string
          notes?: string | null
          verification_id: string
        }
        Update: {
          booking_id?: string
          checked_in_at?: string
          checked_in_by?: string
          guardian_id_matched?: boolean
          id?: string
          notes?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_checkins_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_checkins_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "id_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_consent_tokens: {
        Row: {
          booking_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          token: string
          verification_id: string
        }
        Insert: {
          booking_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token?: string
          verification_id: string
        }
        Update: {
          booking_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_consent_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_consent_tokens_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "id_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      host_activity_log: {
        Row: {
          action: string
          created_at: string
          event_id: string
          guest_email: string | null
          guest_name: string | null
          host_id: string
          id: string
          rsvp_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          host_id: string
          id?: string
          rsvp_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          host_id?: string
          id?: string
          rsvp_id?: string | null
        }
        Relationships: []
      }
      id_verifications: {
        Row: {
          booking_id: string
          consent_accepted_at: string | null
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          detected_age_tier: string | null
          guardian_consent_signed_at: string | null
          guardian_consent_text_version: string | null
          guardian_email: string | null
          guardian_id_image_path: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          id_capture_method: string | null
          id_image_path: string | null
          ocr_confidence: number | null
          ocr_extracted_dob: string | null
          ocr_extracted_name: string | null
          ocr_provider: string | null
          ocr_raw_response: Json | null
          rejection_reason: string | null
          retention_disclosure_version: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          stripe_verification_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          consent_accepted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          detected_age_tier?: string | null
          guardian_consent_signed_at?: string | null
          guardian_consent_text_version?: string | null
          guardian_email?: string | null
          guardian_id_image_path?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          id_capture_method?: string | null
          id_image_path?: string | null
          ocr_confidence?: number | null
          ocr_extracted_dob?: string | null
          ocr_extracted_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          rejection_reason?: string | null
          retention_disclosure_version?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stripe_verification_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          consent_accepted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          detected_age_tier?: string | null
          guardian_consent_signed_at?: string | null
          guardian_consent_text_version?: string | null
          guardian_email?: string | null
          guardian_id_image_path?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          id_capture_method?: string | null
          id_image_path?: string | null
          ocr_confidence?: number | null
          ocr_extracted_dob?: string | null
          ocr_extracted_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          rejection_reason?: string | null
          retention_disclosure_version?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stripe_verification_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_verifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_snapshots: {
        Row: {
          bookings_count: number
          created_at: string
          events_count: number
          failure_reports_count: number
          gift_cards_count: number
          id: string
          mixes_count: number
          paid_bookings_count: number
          rentals_count: number
          rsvps_count: number
          snapshot_date: string
          users_count: number
        }
        Insert: {
          bookings_count?: number
          created_at?: string
          events_count?: number
          failure_reports_count?: number
          gift_cards_count?: number
          id?: string
          mixes_count?: number
          paid_bookings_count?: number
          rentals_count?: number
          rsvps_count?: number
          snapshot_date?: string
          users_count?: number
        }
        Update: {
          bookings_count?: number
          created_at?: string
          events_count?: number
          failure_reports_count?: number
          gift_cards_count?: number
          id?: string
          mixes_count?: number
          paid_bookings_count?: number
          rentals_count?: number
          rsvps_count?: number
          snapshot_date?: string
          users_count?: number
        }
        Relationships: []
      }
      loyalty_coupons: {
        Row: {
          code: string
          created_at: string
          id: string
          issued_at: string
          issued_by_admin: string | null
          notes: string | null
          percent: number
          redeemed_at: string | null
          redeemed_booking_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by_admin: string | null
          threshold: number
          user_email: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          issued_at?: string
          issued_by_admin?: string | null
          notes?: string | null
          percent: number
          redeemed_at?: string | null
          redeemed_booking_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by_admin?: string | null
          threshold: number
          user_email: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          issued_at?: string
          issued_by_admin?: string | null
          notes?: string | null
          percent?: number
          redeemed_at?: string | null
          redeemed_booking_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by_admin?: string | null
          threshold?: number
          user_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_coupons_redeemed_booking_id_fkey"
            columns: ["redeemed_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      mixes: {
        Row: {
          admin_notes: string | null
          cover_art_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          expires_at: string | null
          file_url: string | null
          id: string
          mix_analysis: Json | null
          recorded_at: string | null
          reminder_sent: boolean | null
          status: string
          streaming_url: string | null
          title: string
          tracklist: Json | null
          updated_at: string
          uploaded_by_role: string
          uploaded_by_user_id: string | null
          user_id: string
          user_notes: string | null
          waveform_data: Json | null
        }
        Insert: {
          admin_notes?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          mix_analysis?: Json | null
          recorded_at?: string | null
          reminder_sent?: boolean | null
          status?: string
          streaming_url?: string | null
          title: string
          tracklist?: Json | null
          updated_at?: string
          uploaded_by_role?: string
          uploaded_by_user_id?: string | null
          user_id: string
          user_notes?: string | null
          waveform_data?: Json | null
        }
        Update: {
          admin_notes?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          mix_analysis?: Json | null
          recorded_at?: string | null
          reminder_sent?: boolean | null
          status?: string
          streaming_url?: string | null
          title?: string
          tracklist?: Json | null
          updated_at?: string
          uploaded_by_role?: string
          uploaded_by_user_id?: string | null
          user_id?: string
          user_notes?: string | null
          waveform_data?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_email: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_email: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          recipient_email: string | null
          redeemed: boolean
          redeemed_at: string | null
          redeemed_by: string | null
          room_title: string
          token: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_email?: string | null
          redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by?: string | null
          room_title: string
          token: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_email?: string | null
          redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by?: string | null
          room_title?: string
          token?: string
        }
        Relationships: []
      }
      query_performance_log: {
        Row: {
          calls: number
          captured_at: string
          id: string
          max_exec_ms: number | null
          mean_exec_ms: number
          query_fingerprint: string
          query_sample: string | null
        }
        Insert: {
          calls?: number
          captured_at?: string
          id?: string
          max_exec_ms?: number | null
          mean_exec_ms: number
          query_fingerprint: string
          query_sample?: string | null
        }
        Update: {
          calls?: number
          captured_at?: string
          id?: string
          max_exec_ms?: number | null
          mean_exec_ms?: number
          query_fingerprint?: string
          query_sample?: string | null
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          count: number
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          identifier: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          credit_amount_cents: number
          credit_used_at: string | null
          credit_used_booking_id: string | null
          id: string
          referred_email: string
          referrer_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credit_amount_cents?: number
          credit_used_at?: string | null
          credit_used_booking_id?: string | null
          id?: string
          referred_email: string
          referrer_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credit_amount_cents?: number
          credit_used_at?: string | null
          credit_used_booking_id?: string | null
          id?: string
          referred_email?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_credit_used_booking_id_fkey"
            columns: ["credit_used_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount_cents: number
          booking_id: string | null
          created_at: string
          customer_email: string
          customer_name: string | null
          hours_before_session: number | null
          id: string
          processed_at: string | null
          reason: string
          rental_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rsvp_id: string | null
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_cents: number
          booking_id?: string | null
          created_at?: string
          customer_email: string
          customer_name?: string | null
          hours_before_session?: number | null
          id?: string
          processed_at?: string | null
          reason: string
          rental_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rsvp_id?: string | null
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_cents?: number
          booking_id?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          hours_before_session?: number | null
          id?: string
          processed_at?: string | null
          reason?: string
          rental_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rsvp_id?: string | null
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminder_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          sms_enabled: boolean
          updated_at: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          sms_enabled?: boolean
          updated_at?: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          sms_enabled?: boolean
          updated_at?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      roster_submissions: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          dj_name: string
          email: string
          genre: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          mix_link: string
          press_photo_url: string | null
          reviewed_at: string | null
          soundcloud: string | null
          spotify: string | null
          status: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          dj_name: string
          email: string
          genre?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          mix_link: string
          press_photo_url?: string | null
          reviewed_at?: string | null
          soundcloud?: string | null
          spotify?: string | null
          status?: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          dj_name?: string
          email?: string
          genre?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          mix_link?: string
          press_photo_url?: string | null
          reviewed_at?: string | null
          soundcloud?: string | null
          spotify?: string | null
          status?: string
        }
        Relationships: []
      }
      screening_review_log: {
        Row: {
          action: string
          actor_id: string | null
          booking_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          booking_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_review_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_guests: {
        Row: {
          consent_signature_path: string | null
          consent_signed_at: string | null
          consent_signer_name: string | null
          created_at: string
          guest_name: string
          id: string
          id_analysis: Json | null
          id_photo_path: string | null
          id_verified: string
          session_invite_id: string
        }
        Insert: {
          consent_signature_path?: string | null
          consent_signed_at?: string | null
          consent_signer_name?: string | null
          created_at?: string
          guest_name: string
          id?: string
          id_analysis?: Json | null
          id_photo_path?: string | null
          id_verified?: string
          session_invite_id: string
        }
        Update: {
          consent_signature_path?: string | null
          consent_signed_at?: string | null
          consent_signer_name?: string | null
          created_at?: string
          guest_name?: string
          id?: string
          id_analysis?: Json | null
          id_photo_path?: string | null
          id_verified?: string
          session_invite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_guests_session_invite_id_fkey"
            columns: ["session_invite_id"]
            isOneToOne: false
            referencedRelation: "session_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      session_invites: {
        Row: {
          booking_date: string
          booking_id: string
          booking_time: string
          created_at: string
          created_by_name: string
          id: string
          room_title: string
          token: string
        }
        Insert: {
          booking_date: string
          booking_id: string
          booking_time: string
          created_at?: string
          created_by_name: string
          id?: string
          room_title: string
          token?: string
        }
        Update: {
          booking_date?: string
          booking_id?: string
          booking_time?: string
          created_at?: string
          created_by_name?: string
          id?: string
          room_title?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          author_name: string
          created_at: string
          id: string
          message: string
          session_invite_id: string
        }
        Insert: {
          author_name: string
          created_at?: string
          id?: string
          message: string
          session_invite_id: string
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          message?: string
          session_invite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_invite_id_fkey"
            columns: ["session_invite_id"]
            isOneToOne: false
            referencedRelation: "session_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          admin_notification_recipients: string[]
          booking_buffer_minutes: number
          booking_lead_minutes: number | null
          booking_lookahead_days: number | null
          booking_pauses: Json
          business_address: string | null
          business_dba: string | null
          business_hours: Json
          business_legal_name: string | null
          business_locale: string | null
          business_tax_id: string | null
          business_timezone: string | null
          cancellation_cutoff_hours: number | null
          cancellation_policy_text: string | null
          conduct_policy_text: string | null
          contact_phone_display: string | null
          daily_session_cap: number
          email_senders: Json
          email_toggles: Json
          emergency_contact_phone: string | null
          equipment_lock_ttl_minutes: number | null
          favicon_url: string | null
          footer_text: string | null
          guardian_consent_text: string | null
          guardian_consent_text_version: string | null
          hero_headline: string | null
          hero_subhead: string | null
          id: number
          id_retention_days: number
          id_retention_disclosure_text: string | null
          id_retention_disclosure_version: string
          id_retention_enabled: boolean
          latest_video_url: string | null
          logo_dark_url: string | null
          logo_light_url: string | null
          maintenance_message: string | null
          maintenance_mode: boolean
          meta_capi_token: string | null
          meta_pixel_id: string | null
          orbit_enabled: boolean
          orbit_nodes: Json
          refund_policy_text: string | null
          rental_policy_text: string | null
          shared_room_pool: boolean
          slot_lock_ttl_minutes: number | null
          sms_sender_number: string | null
          soundcloud_embed_url: string | null
          stripe_mode: string
          studio_hero_hue: string | null
          twitch_channel: string | null
          updated_at: string
          verification_v2_admin_only: boolean
          vision_mode_enabled: boolean
          youtube_channel_handle: string | null
        }
        Insert: {
          admin_notification_recipients?: string[]
          booking_buffer_minutes?: number
          booking_lead_minutes?: number | null
          booking_lookahead_days?: number | null
          booking_pauses?: Json
          business_address?: string | null
          business_dba?: string | null
          business_hours?: Json
          business_legal_name?: string | null
          business_locale?: string | null
          business_tax_id?: string | null
          business_timezone?: string | null
          cancellation_cutoff_hours?: number | null
          cancellation_policy_text?: string | null
          conduct_policy_text?: string | null
          contact_phone_display?: string | null
          daily_session_cap?: number
          email_senders?: Json
          email_toggles?: Json
          emergency_contact_phone?: string | null
          equipment_lock_ttl_minutes?: number | null
          favicon_url?: string | null
          footer_text?: string | null
          guardian_consent_text?: string | null
          guardian_consent_text_version?: string | null
          hero_headline?: string | null
          hero_subhead?: string | null
          id?: number
          id_retention_days?: number
          id_retention_disclosure_text?: string | null
          id_retention_disclosure_version?: string
          id_retention_enabled?: boolean
          latest_video_url?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          orbit_enabled?: boolean
          orbit_nodes?: Json
          refund_policy_text?: string | null
          rental_policy_text?: string | null
          shared_room_pool?: boolean
          slot_lock_ttl_minutes?: number | null
          sms_sender_number?: string | null
          soundcloud_embed_url?: string | null
          stripe_mode?: string
          studio_hero_hue?: string | null
          twitch_channel?: string | null
          updated_at?: string
          verification_v2_admin_only?: boolean
          vision_mode_enabled?: boolean
          youtube_channel_handle?: string | null
        }
        Update: {
          admin_notification_recipients?: string[]
          booking_buffer_minutes?: number
          booking_lead_minutes?: number | null
          booking_lookahead_days?: number | null
          booking_pauses?: Json
          business_address?: string | null
          business_dba?: string | null
          business_hours?: Json
          business_legal_name?: string | null
          business_locale?: string | null
          business_tax_id?: string | null
          business_timezone?: string | null
          cancellation_cutoff_hours?: number | null
          cancellation_policy_text?: string | null
          conduct_policy_text?: string | null
          contact_phone_display?: string | null
          daily_session_cap?: number
          email_senders?: Json
          email_toggles?: Json
          emergency_contact_phone?: string | null
          equipment_lock_ttl_minutes?: number | null
          favicon_url?: string | null
          footer_text?: string | null
          guardian_consent_text?: string | null
          guardian_consent_text_version?: string | null
          hero_headline?: string | null
          hero_subhead?: string | null
          id?: number
          id_retention_days?: number
          id_retention_disclosure_text?: string | null
          id_retention_disclosure_version?: string
          id_retention_enabled?: boolean
          latest_video_url?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          orbit_enabled?: boolean
          orbit_nodes?: Json
          refund_policy_text?: string | null
          rental_policy_text?: string | null
          shared_room_pool?: boolean
          slot_lock_ttl_minutes?: number | null
          sms_sender_number?: string | null
          soundcloud_embed_url?: string | null
          stripe_mode?: string
          studio_hero_hue?: string | null
          twitch_channel?: string | null
          updated_at?: string
          verification_v2_admin_only?: boolean
          vision_mode_enabled?: boolean
          youtube_channel_handle?: string | null
        }
        Relationships: []
      }
      slot_locks: {
        Row: {
          booking_date: string
          booking_id: string | null
          booking_time: string
          created_at: string
          expires_at: string
          id: string
          locked_by_email: string
          room_title: string
          stripe_session_id: string | null
        }
        Insert: {
          booking_date: string
          booking_id?: string | null
          booking_time: string
          created_at?: string
          expires_at: string
          id?: string
          locked_by_email: string
          room_title: string
          stripe_session_id?: string | null
        }
        Update: {
          booking_date?: string
          booking_id?: string | null
          booking_time?: string
          created_at?: string
          expires_at?: string
          id?: string
          locked_by_email?: string
          room_title?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      stripe_checkout_idempotency: {
        Row: {
          booking_id: string | null
          created_at: string
          expires_at: string
          idempotency_key: string
          stripe_session_id: string
          stripe_session_url: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          expires_at?: string
          idempotency_key: string
          stripe_session_id: string
          stripe_session_url: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          stripe_session_id?: string
          stripe_session_url?: string
        }
        Relationships: []
      }
      stripe_disputes: {
        Row: {
          amount_cents: number
          booking_id: string | null
          created_at: string
          currency: string
          evidence_due_by: string | null
          id: string
          raw_payload: Json | null
          reason: string | null
          rental_id: string | null
          rsvp_id: string | null
          status: string
          stripe_charge_id: string | null
          stripe_dispute_id: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          evidence_due_by?: string | null
          id?: string
          raw_payload?: Json | null
          reason?: string | null
          rental_id?: string | null
          rsvp_id?: string | null
          status: string
          stripe_charge_id?: string | null
          stripe_dispute_id: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          evidence_due_by?: string | null
          id?: string
          raw_payload?: Json | null
          reason?: string | null
          rental_id?: string | null
          rsvp_id?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_dispute_id?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      studio_configurations: {
        Row: {
          addons: Json
          base_price_cents: number | null
          card_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          gallery_image_urls: string[]
          hero_image_url: string | null
          id: string
          is_active: boolean
          layouts: Json
          sort_order: number
          starting_at_copy: string | null
          studio_key: string
          tiers: Json
          updated_at: string
        }
        Insert: {
          addons?: Json
          base_price_cents?: number | null
          card_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          gallery_image_urls?: string[]
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          layouts?: Json
          sort_order?: number
          starting_at_copy?: string | null
          studio_key: string
          tiers?: Json
          updated_at?: string
        }
        Update: {
          addons?: Json
          base_price_cents?: number | null
          card_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          gallery_image_urls?: string[]
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          layouts?: Json
          sort_order?: number
          starting_at_copy?: string | null
          studio_key?: string
          tiers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      talent: {
        Row: {
          alias: string
          bio: string
          created_at: string
          genre: string
          id: string
          image_url: string
          instagram_url: string | null
          location: string | null
          name: string | null
          preview_track_url: string | null
          sort_order: number
          soundcloud_url: string | null
          spotify_url: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          alias: string
          bio: string
          created_at?: string
          genre: string
          id?: string
          image_url: string
          instagram_url?: string | null
          location?: string | null
          name?: string | null
          preview_track_url?: string | null
          sort_order?: number
          soundcloud_url?: string | null
          spotify_url?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          alias?: string
          bio?: string
          created_at?: string
          genre?: string
          id?: string
          image_url?: string
          instagram_url?: string | null
          location?: string | null
          name?: string | null
          preview_track_url?: string | null
          sort_order?: number
          soundcloud_url?: string | null
          spotify_url?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string
          id: string
          notified: boolean
          notified_at: string | null
          room_title: string
          user_email: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          room_title: string
          user_email: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          room_title?: string
          user_email?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          source: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          source?: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      site_settings_public: {
        Row: {
          booking_lead_minutes: number | null
          booking_lookahead_days: number | null
          booking_pauses: Json | null
          cancellation_cutoff_hours: number | null
          emergency_contact_phone: string | null
          favicon_url: string | null
          id: number | null
          latest_video_url: string | null
          logo_dark_url: string | null
          logo_light_url: string | null
          maintenance_message: string | null
          maintenance_mode: boolean | null
          orbit_enabled: boolean | null
          orbit_nodes: Json | null
          refund_policy_text: string | null
          soundcloud_embed_url: string | null
          studio_hero_hue: string | null
          twitch_channel: string | null
          updated_at: string | null
          vision_mode_enabled: boolean | null
          youtube_channel_handle: string | null
        }
        Insert: {
          booking_lead_minutes?: number | null
          booking_lookahead_days?: number | null
          booking_pauses?: Json | null
          cancellation_cutoff_hours?: number | null
          emergency_contact_phone?: string | null
          favicon_url?: string | null
          id?: number | null
          latest_video_url?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean | null
          orbit_enabled?: boolean | null
          orbit_nodes?: Json | null
          refund_policy_text?: string | null
          soundcloud_embed_url?: string | null
          studio_hero_hue?: string | null
          twitch_channel?: string | null
          updated_at?: string | null
          vision_mode_enabled?: boolean | null
          youtube_channel_handle?: string | null
        }
        Update: {
          booking_lead_minutes?: number | null
          booking_lookahead_days?: number | null
          booking_pauses?: Json | null
          cancellation_cutoff_hours?: number | null
          emergency_contact_phone?: string | null
          favicon_url?: string | null
          id?: number | null
          latest_video_url?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean | null
          orbit_enabled?: boolean | null
          orbit_nodes?: Json | null
          refund_policy_text?: string | null
          soundcloud_embed_url?: string | null
          studio_hero_hue?: string | null
          twitch_channel?: string | null
          updated_at?: string | null
          vision_mode_enabled?: boolean | null
          youtube_channel_handle?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_equipment_lock: {
        Args: {
          p_email: string
          p_equipment_name: string
          p_pickup_date: string
          p_rental_days: number
          p_ttl_seconds?: number
        }
        Returns: {
          acquired: boolean
          conflict_reason: string
          lock_id: string
        }[]
      }
      acquire_slot_lock: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_email: string
          p_room_title: string
          p_ttl_seconds?: number
        }
        Returns: {
          acquired: boolean
          conflict_reason: string
          lock_id: string
        }[]
      }
      admin_delete_tier: {
        Args: { p_studio_key: string; p_tier_id: string }
        Returns: {
          addons: Json
          base_price_cents: number | null
          card_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          gallery_image_urls: string[]
          hero_image_url: string | null
          id: string
          is_active: boolean
          layouts: Json
          sort_order: number
          starting_at_copy: string | null
          studio_key: string
          tiers: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "studio_configurations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_loyalty_coupons: {
        Args: never
        Returns: {
          code: string
          id: string
          issued_at: string
          paid_session_count: number
          percent: number
          redeemed_at: string
          redeemed_booking_id: string
          revoke_reason: string
          revoked_at: string
          threshold: number
          user_email: string
        }[]
      }
      admin_update_service: {
        Args: { p_payload: Json; p_studio_key: string }
        Returns: {
          addons: Json
          base_price_cents: number | null
          card_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          gallery_image_urls: string[]
          hero_image_url: string | null
          id: string
          is_active: boolean
          layouts: Json
          sort_order: number
          starting_at_copy: string | null
          studio_key: string
          tiers: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "studio_configurations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_tier: {
        Args: { p_studio_key: string; p_tier: Json }
        Returns: {
          addons: Json
          base_price_cents: number | null
          card_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          gallery_image_urls: string[]
          hero_image_url: string | null
          id: string
          is_active: boolean
          layouts: Json
          sort_order: number
          starting_at_copy: string | null
          studio_key: string
          tiers: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "studio_configurations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      capture_integrity_snapshot: { Args: never; Returns: string }
      capture_slow_queries: {
        Args: { p_min_mean_ms?: number }
        Returns: number
      }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_max: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after_seconds: number
        }[]
      }
      check_slot_available: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_email: string
          p_room_title: string
        }
        Returns: {
          available: boolean
          reason: string
        }[]
      }
      cleanup_expired_sensitive_data: {
        Args: never
        Returns: {
          consent_signature_path: string
          id_photo_path: string
          record_id: string
          source_table: string
        }[]
      }
      cleanup_expired_slot_locks: { Args: never; Returns: number }
      cleanup_expired_stripe_idempotency: { Args: never; Returns: number }
      cleanup_rate_limit_counters: { Args: never; Returns: number }
      clear_sensitive_data: {
        Args: { p_record_id: string; p_source: string }
        Returns: boolean
      }
      confirm_event_rsvp_with_capacity: {
        Args: { p_rsvp_id: string; p_ticket_code: string }
        Returns: {
          already_confirmed: boolean
          over_capacity: boolean
          rsvp_id: string
          success: boolean
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_abandoned_draft_bookings: { Args: never; Returns: number }
      extend_slot_lock_for_verification: {
        Args: { p_booking_id: string; p_extension_minutes?: number }
        Returns: Json
      }
      get_active_equipment_locks: {
        Args: never
        Returns: {
          created_at: string
          equipment_name: string
          expires_at: string
          id: string
          pickup_date: string
          rental_days: number
        }[]
      }
      get_active_slot_locks: {
        Args: never
        Returns: {
          booking_date: string
          booking_time: string
          created_at: string
          expires_at: string
          id: string
          room_title: string
        }[]
      }
      get_booking_density_settings: {
        Args: never
        Returns: {
          booking_buffer_minutes: number
          daily_session_cap: number
          shared_room_pool: boolean
        }[]
      }
      get_booking_status_by_token: {
        Args: { p_token: string }
        Returns: {
          address_revealed: boolean
          booking_date: string
          booking_id: string
          booking_time: string
          created_at: string
          customer_name: string
          decline_reason: string
          review_deadline: string
          room_title: string
          screening_status: string
        }[]
      }
      get_day_booked_times: {
        Args: { p_booking_date: string }
        Returns: {
          booking_time: string
          room_title: string
        }[]
      }
      get_day_booking_count: {
        Args: { p_booking_date: string }
        Returns: number
      }
      get_event_attendance: { Args: { p_event_id: string }; Returns: Json }
      get_host_event: {
        Args: { p_token: string }
        Returns: {
          capacity: number
          cover_image_url: string
          description: string
          end_time: string
          event_date: string
          event_id: string
          event_type: string
          host_id: string
          host_name: string
          is_free: boolean
          location: string
          organization: string
          price_cents: number
          refund_policy: string
          room_title: string
          start_time: string
          status: string
          title: string
        }[]
      }
      get_host_rsvps: {
        Args: { p_token: string }
        Returns: {
          amount_paid_cents: number
          checked_in_at: string
          created_at: string
          id: string
          payment_status: string
          status: string
          ticket_code: string
          user_email: string
          user_name: string
          waitlist_position: number
        }[]
      }
      get_host_sales_stats: {
        Args: { p_event_id: string }
        Returns: {
          confirmed_tickets: number
          host_id: string
          last_sale_at: string
          revenue_cents: number
          tickets_sold: number
        }[]
      }
      get_latest_video_url: { Args: never; Returns: string }
      get_loyalty_info: { Args: { user_email: string }; Returns: Json }
      get_meta_pixel_id: { Args: never; Returns: string }
      get_referral_credits: { Args: { user_id: string }; Returns: Json }
      get_session_invite_by_booking: {
        Args: { p_booking_id: string }
        Returns: {
          booking_date: string
          booking_id: string
          booking_time: string
          created_at: string
          created_by_name: string
          id: string
          room_title: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "session_invites"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_session_invite_by_token: {
        Args: { invite_token: string }
        Returns: {
          booking_date: string
          booking_id: string
          booking_time: string
          created_at: string
          created_by_name: string
          id: string
          room_title: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "session_invites"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_session_messages_by_token: {
        Args: { p_token: string }
        Returns: {
          author_name: string
          created_at: string
          id: string
          message: string
          session_invite_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "session_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_stripe_mode: { Args: never; Returns: string }
      get_unavailable_equipment: {
        Args: never
        Returns: {
          available_after: string
          equipment_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      host_check_in: {
        Args: { p_check_in: boolean; p_rsvp_id: string; p_token: string }
        Returns: boolean
      }
      is_blocked: {
        Args: { p_email: string; p_name?: string; p_phone?: string }
        Returns: boolean
      }
      issue_threshold_coupons_for_email: {
        Args: { p_email: string }
        Returns: number
      }
      list_expired_id_verifications: {
        Args: { p_retention_days?: number }
        Returns: {
          booking_date: string
          booking_id: string
          storage_path: string
          uploaded_at: string
          verification_id: string
        }[]
      }
      log_host_access: { Args: { p_token: string }; Returns: boolean }
      loyalty_threshold_percent: {
        Args: { p_threshold: number }
        Returns: number
      }
      mark_id_verification_deleted: {
        Args: { p_reason?: string; p_verification_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_waitlist_for_slot: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_room_title: string
        }
        Returns: {
          notified_id: string
          user_email: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rebook_existing_booking: {
        Args: {
          p_amount_cents: number
          p_backdrop?: string
          p_booking_date: string
          p_booking_id: string
          p_booking_time: string
          p_custom_requests?: string
          p_equipment: Json
          p_layout: string
          p_lighting: string
          p_room_title: string
          p_sound: string
          p_tier: string
        }
        Returns: Json
      }
      redeem_loyalty_coupon: {
        Args: { p_booking_id: string; p_coupon_id: string; p_email: string }
        Returns: {
          percent: number
          reason: string
          success: boolean
        }[]
      }
      release_equipment_locks: {
        Args: { p_lock_ids: string[] }
        Returns: number
      }
      release_slot_lock: { Args: { p_lock_id: string }; Returns: boolean }
      upsert_draft_booking: {
        Args: {
          p_amount_cents: number
          p_backdrop?: string
          p_booking_date: string
          p_booking_time: string
          p_custom_requests?: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_equipment: Json
          p_layout: string
          p_lighting: string
          p_room_title: string
          p_sound: string
          p_tier: string
        }
        Returns: {
          booking_id: string
          reused: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      booking_tab_layout_variant: "single" | "gallery" | "collage"
      booking_tab_type:
        | "dj_session"
        | "podcast"
        | "studio_sesh"
        | "backdrop"
        | "equipment_rental"
        | "livestream"
        | "music"
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
      app_role: ["admin", "moderator", "user"],
      booking_tab_layout_variant: ["single", "gallery", "collage"],
      booking_tab_type: [
        "dj_session",
        "podcast",
        "studio_sesh",
        "backdrop",
        "equipment_rental",
        "livestream",
        "music",
      ],
    },
  },
} as const
