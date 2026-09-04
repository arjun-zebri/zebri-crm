export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_copilot_usage: {
        Row: {
          created_at: string
          day: string
          id: string
          message_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          message_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          message_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_actions: {
        Row: {
          automation_id: string
          branch_path: string | null
          config: Json
          created_at: string
          disabled: boolean
          id: string
          label: string | null
          parent_action_id: string | null
          position: number
          position_x: number | null
          position_y: number | null
          type: string
          updated_at: string
        }
        Insert: {
          automation_id: string
          branch_path?: string | null
          config?: Json
          created_at?: string
          disabled?: boolean
          id?: string
          label?: string | null
          parent_action_id?: string | null
          position: number
          position_x?: number | null
          position_y?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          automation_id?: string
          branch_path?: string | null
          config?: Json
          created_at?: string
          disabled?: boolean
          id?: string
          label?: string | null
          parent_action_id?: string | null
          position?: number
          position_x?: number | null
          position_y?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_actions_parent_action_id_fkey"
            columns: ["parent_action_id"]
            isOneToOne: false
            referencedRelation: "automation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_audit_log: {
        Row: {
          action_id: string | null
          automation_id: string
          created_at: string
          details: Json
          event: string
          id: string
          run_id: string | null
          user_id: string
        }
        Insert: {
          action_id?: string | null
          automation_id: string
          created_at?: string
          details?: Json
          event: string
          id?: string
          run_id?: string | null
          user_id: string
        }
        Update: {
          action_id?: string | null
          automation_id?: string
          created_at?: string
          details?: Json
          event?: string
          id?: string
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_audit_log_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "automation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_audit_log_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_audit_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          couple_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          source_id: string | null
          source_table: string
          user_id: string
        }
        Insert: {
          couple_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source_id?: string | null
          source_table: string
          user_id: string
        }
        Update: {
          couple_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source_id?: string | null
          source_table?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          completed_at: string | null
          couple_id: string | null
          current_action_id: string | null
          error_message: string | null
          event_id: string
          id: string
          last_payload: Json
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          couple_id?: string | null
          current_action_id?: string | null
          error_message?: string | null
          event_id: string
          id?: string
          last_payload?: Json
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          couple_id?: string | null
          current_action_id?: string | null
          error_message?: string | null
          event_id?: string
          id?: string
          last_payload?: Json
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_current_action_id_fkey"
            columns: ["current_action_id"]
            isOneToOne: false
            referencedRelation: "automation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_waits: {
        Row: {
          action_id: string
          consumed_at: string | null
          created_at: string
          id: string
          payload: Json
          reason: string
          run_id: string
          token: string | null
          user_id: string
          wake_at: string
        }
        Insert: {
          action_id: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          payload?: Json
          reason: string
          run_id: string
          token?: string | null
          user_id: string
          wake_at: string
        }
        Update: {
          action_id?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          payload?: Json
          reason?: string
          run_id?: string
          token?: string | null
          user_id?: string
          wake_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_waits_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "automation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_waits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          branch_depth_limit: number
          created_at: string
          description: string | null
          id: string
          name: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          status: string
          template_slug: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          branch_depth_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          status?: string
          template_slug?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          branch_depth_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          status?: string
          template_slug?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      availability_overrides: {
        Row: {
          available: boolean
          created_at: string
          date: string
          end_time: string | null
          id: string
          start_time: string | null
          user_id: string
        }
        Insert: {
          available: boolean
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          couple_id: string | null
          created_at: string
          email: string
          ends_at: string
          external_event_ids: Json
          id: string
          manage_token: string
          meeting_type_id: string
          name: string
          notes: string | null
          partner_name: string | null
          phone: string | null
          reminder_sent_at: string | null
          starts_at: string
          status: string
          timezone: string
          updated_at: string
          user_id: string
          video_join_url: string | null
        }
        Insert: {
          cancelled_at?: string | null
          couple_id?: string | null
          created_at?: string
          email: string
          ends_at: string
          external_event_ids?: Json
          id?: string
          manage_token?: string
          meeting_type_id: string
          name: string
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          reminder_sent_at?: string | null
          starts_at: string
          status?: string
          timezone: string
          updated_at?: string
          user_id: string
          video_join_url?: string | null
        }
        Update: {
          cancelled_at?: string | null
          couple_id?: string | null
          created_at?: string
          email?: string
          ends_at?: string
          external_event_ids?: Json
          id?: string
          manage_token?: string
          meeting_type_id?: string
          name?: string
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          reminder_sent_at?: string | null
          starts_at?: string
          status?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          video_join_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          build_sha: string | null
          created_at: string
          description: string
          id: string
          notion_page_id: string | null
          notion_page_url: string | null
          notion_sync_error: string | null
          notion_sync_status: string
          notion_ticket_ref: string | null
          page_url: string
          report_type: string
          route_path: string
          screenshot_filename: string | null
          title: string
          updated_at: string
          user_agent: string | null
          user_id: string
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          build_sha?: string | null
          created_at?: string
          description: string
          id?: string
          notion_page_id?: string | null
          notion_page_url?: string | null
          notion_sync_error?: string | null
          notion_sync_status?: string
          notion_ticket_ref?: string | null
          page_url: string
          report_type: string
          route_path: string
          screenshot_filename?: string | null
          title: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          build_sha?: string | null
          created_at?: string
          description?: string
          id?: string
          notion_page_id?: string | null
          notion_page_url?: string | null
          notion_sync_error?: string | null
          notion_sync_status?: string
          notion_ticket_ref?: string | null
          page_url?: string
          report_type?: string
          route_path?: string
          screenshot_filename?: string | null
          title?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token_encrypted: string
          account_email: string
          calendar_id: string | null
          connected_at: string
          created_at: string
          id: string
          last_error: string | null
          provider: string
          refresh_token_encrypted: string
          status: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          account_email: string
          calendar_id?: string | null
          connected_at?: string
          created_at?: string
          id?: string
          last_error?: string | null
          provider: string
          refresh_token_encrypted: string
          status?: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          account_email?: string
          calendar_id?: string | null
          connected_at?: string
          created_at?: string
          id?: string
          last_error?: string | null
          provider?: string
          refresh_token_encrypted?: string
          status?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connect_accounts: {
        Row: {
          account_id: string | null
          business_type: string | null
          charges_enabled: boolean
          country: string | null
          created_at: string
          default_currency: string | null
          details_submitted: boolean
          disabled_reason: string | null
          last_account_id: string | null
          payouts_enabled: boolean
          requirements_currently_due: Json
          requirements_past_due: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          business_type?: string | null
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          disabled_reason?: string | null
          last_account_id?: string | null
          payouts_enabled?: boolean
          requirements_currently_due?: Json
          requirements_past_due?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          business_type?: string | null
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          disabled_reason?: string | null
          last_account_id?: string | null
          payouts_enabled?: boolean
          requirements_currently_due?: Json
          requirements_past_due?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          category: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          user_id: string
        }
        Insert: {
          category?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          user_id: string
        }
        Update: {
          category?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_audit_log: {
        Row: {
          actor: string
          actor_ip: string | null
          actor_user_agent: string | null
          contract_id: string
          decline_reason: string | null
          event_at: string
          event_type: string
          id: string
          reminder_number: number | null
          revoked_from_status: string | null
          signer_name_typed: string | null
          user_id: string
        }
        Insert: {
          actor: string
          actor_ip?: string | null
          actor_user_agent?: string | null
          contract_id: string
          decline_reason?: string | null
          event_at?: string
          event_type: string
          id?: string
          reminder_number?: number | null
          revoked_from_status?: string | null
          signer_name_typed?: string | null
          user_id: string
        }
        Update: {
          actor?: string
          actor_ip?: string | null
          actor_user_agent?: string | null
          contract_id?: string
          decline_reason?: string | null
          event_at?: string
          event_type?: string
          id?: string
          reminder_number?: number | null
          revoked_from_status?: string | null
          signer_name_typed?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signer_otps: {
        Row: {
          attempts: number
          code_hash: string
          code_salt: string
          consumed_at: string | null
          contract_id: string
          created_at: string
          expires_at: string
          id: string
          locked_until: string | null
          signer_id: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          code_salt: string
          consumed_at?: string | null
          contract_id: string
          created_at?: string
          expires_at: string
          id?: string
          locked_until?: string | null
          signer_id: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          code_salt?: string
          consumed_at?: string | null
          contract_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          locked_until?: string | null
          signer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signer_otps_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signer_otps_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "contract_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signers: {
        Row: {
          contract_id: string
          created_at: string
          declined_at: string | null
          declined_reason: string | null
          email: string | null
          id: string
          name: string
          otp_verified_at: string | null
          required: boolean
          role: string
          sign_token: string
          signature_image: string | null
          signature_mode: string
          signed_at: string | null
          signer_ip: string | null
          signer_name_typed: string | null
          signer_user_agent: string | null
          signing_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          declined_at?: string | null
          declined_reason?: string | null
          email?: string | null
          id?: string
          name: string
          otp_verified_at?: string | null
          required?: boolean
          role: string
          sign_token?: string
          signature_image?: string | null
          signature_mode?: string
          signed_at?: string | null
          signer_ip?: string | null
          signer_name_typed?: string | null
          signer_user_agent?: string | null
          signing_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          declined_at?: string | null
          declined_reason?: string | null
          email?: string | null
          id?: string
          name?: string
          otp_verified_at?: string | null
          required?: boolean
          role?: string
          sign_token?: string
          signature_image?: string | null
          signature_mode?: string
          signed_at?: string | null
          signer_ip?: string | null
          signer_name_typed?: string | null
          signer_user_agent?: string | null
          signing_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          is_starter: boolean
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_starter?: boolean
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_starter?: boolean
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          content: Json
          contract_number: string
          couple_id: string
          created_at: string
          declined_at: string | null
          declined_reason: string | null
          document_hash: string | null
          document_hash_algo: string | null
          document_hash_at: string | null
          email_sent_at: string | null
          expires_at: string | null
          id: string
          last_reminder_at: string | null
          locked_content: Json | null
          locked_content_html: string | null
          mc_signature_name: string | null
          notes: string | null
          reminder_count: number
          require_signer_otp: boolean
          share_token: string
          share_token_enabled: boolean
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          signing_mode: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: Json
          contract_number: string
          couple_id: string
          created_at?: string
          declined_at?: string | null
          declined_reason?: string | null
          document_hash?: string | null
          document_hash_algo?: string | null
          document_hash_at?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          locked_content?: Json | null
          locked_content_html?: string | null
          mc_signature_name?: string | null
          notes?: string | null
          reminder_count?: number
          require_signer_otp?: boolean
          share_token?: string
          share_token_enabled?: boolean
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          signing_mode?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content?: Json
          contract_number?: string
          couple_id?: string
          created_at?: string
          declined_at?: string | null
          declined_reason?: string | null
          document_hash?: string | null
          document_hash_algo?: string | null
          document_hash_at?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          locked_content?: Json | null
          locked_content_html?: string | null
          mc_signature_name?: string | null
          notes?: string | null
          reminder_count?: number
          require_signer_otp?: boolean
          share_token?: string
          share_token_enabled?: boolean
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          signing_mode?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_contacts: {
        Row: {
          contact_id: string
          couple_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          couple_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          couple_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_vendors_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_vendors_vendor_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_custom_fields: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "couple_custom_fields_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_emails: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          sent_at: string
          source: string
          status: string
          subject: string
          template_id: string | null
          template_name: string | null
          to_email: string
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          sent_at?: string
          source?: string
          status?: string
          subject: string
          template_id?: string | null
          template_name?: string | null
          to_email: string
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          sent_at?: string
          source?: string
          status?: string
          subject?: string
          template_id?: string | null
          template_name?: string | null
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_emails_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_questionnaires: {
        Row: {
          completed_at: string | null
          couple_id: string
          created_at: string
          description: string | null
          display_mode: string
          id: string
          questions: Json
          responses: Json
          sent_at: string | null
          share_token: string
          share_token_enabled: boolean
          status: string
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          completed_at?: string | null
          couple_id: string
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          questions?: Json
          responses?: Json
          sent_at?: string | null
          share_token?: string
          share_token_enabled?: boolean
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          completed_at?: string | null
          couple_id?: string
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          questions?: Json
          responses?: Json
          sent_at?: string | null
          share_token?: string
          share_token_enabled?: boolean
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couple_questionnaires_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_questionnaires_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          slug: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          slug: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      couple_time_entries: {
        Row: {
          auto_stopped: boolean
          category_id: string | null
          couple_id: string
          created_at: string
          ended_at: string | null
          id: string
          note: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          auto_stopped?: boolean
          category_id?: string | null
          couple_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          started_at: string
          user_id: string
        }
        Update: {
          auto_stopped?: boolean
          category_id?: string | null
          couple_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_time_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "time_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_time_entries_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          email: string | null
          event_date: string | null
          id: string
          kanban_position: number | null
          lead_source: string | null
          name: string
          notes: string | null
          phone: string | null
          portal_token: string
          portal_token_enabled: boolean
          primary_email: string | null
          primary_name: string | null
          primary_phone: string | null
          referral_source: string | null
          secondary_email: string | null
          secondary_name: string | null
          secondary_phone: string | null
          secondary_portal_token: string
          selected_package_id: string | null
          source_origin: string | null
          status: string
          user_id: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          id?: string
          kanban_position?: number | null
          lead_source?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          portal_token?: string
          portal_token_enabled?: boolean
          primary_email?: string | null
          primary_name?: string | null
          primary_phone?: string | null
          referral_source?: string | null
          secondary_email?: string | null
          secondary_name?: string | null
          secondary_phone?: string | null
          secondary_portal_token?: string
          selected_package_id?: string | null
          source_origin?: string | null
          status?: string
          user_id: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          id?: string
          kanban_position?: number | null
          lead_source?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          portal_token?: string
          portal_token_enabled?: boolean
          primary_email?: string | null
          primary_name?: string | null
          primary_phone?: string | null
          referral_source?: string | null
          secondary_email?: string | null
          secondary_name?: string | null
          secondary_phone?: string | null
          secondary_portal_token?: string
          selected_package_id?: string | null
          source_origin?: string | null
          status?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couples_selected_package_id_fkey"
            columns: ["selected_package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_template_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_files_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          archived_at: string | null
          category_id: string | null
          content: Json
          created_at: string
          description: string | null
          id: string
          is_starter: boolean
          lifecycle_stage: string | null
          name: string
          position: number
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_starter?: boolean
          lifecycle_stage?: string | null
          name: string
          position?: number
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_starter?: boolean
          lifecycle_stage?: string | null
          name?: string
          position?: number
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "email_template_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contacts: {
        Row: {
          contact_id: string
          created_at: string
          event_id: string
          id: string
          role_notes: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_id: string
          id?: string
          role_notes?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_id?: string
          id?: string
          role_notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendors_vendor_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          couple_id: string
          created_at: string
          date: string
          drive_distance_from_home_meters: number | null
          drive_distance_to_next_event_meters: number | null
          drive_time_from_home_seconds: number | null
          drive_time_to_next_event_seconds: number | null
          event_type: string
          id: string
          share_token: string | null
          share_token_enabled: boolean
          status: string
          timeline_notes: string | null
          title: string | null
          user_id: string
          venue: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_phone: string | null
          venue_website: string | null
        }
        Insert: {
          couple_id: string
          created_at?: string
          date: string
          drive_distance_from_home_meters?: number | null
          drive_distance_to_next_event_meters?: number | null
          drive_time_from_home_seconds?: number | null
          drive_time_to_next_event_seconds?: number | null
          event_type?: string
          id?: string
          share_token?: string | null
          share_token_enabled?: boolean
          status?: string
          timeline_notes?: string | null
          title?: string | null
          user_id: string
          venue?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_phone?: string | null
          venue_website?: string | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          date?: string
          drive_distance_from_home_meters?: number | null
          drive_distance_to_next_event_meters?: number | null
          drive_time_from_home_seconds?: number | null
          drive_time_to_next_event_seconds?: number | null
          event_type?: string
          id?: string
          share_token?: string | null
          share_token_enabled?: boolean
          status?: string
          timeline_notes?: string | null
          title?: string | null
          user_id?: string
          venue?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_phone?: string | null
          venue_website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          couple_id: string | null
          created_at: string
          id: string
          payload: Json
          source_origin: string | null
          user_id: string
        }
        Insert: {
          couple_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          source_origin?: string | null
          user_id: string
        }
        Update: {
          couple_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          source_origin?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          note: string | null
          position: number
          quantity: number
          unit_price: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          note?: string | null
          position: number
          quantity?: number
          unit_price: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          note?: string | null
          position?: number
          quantity?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_stages: {
        Row: {
          amount_cents: number
          amount_type: string
          amount_value: number | null
          due_date: string | null
          due_offset_anchor: string | null
          due_offset_unit: string | null
          due_offset_value: number | null
          id: string
          invoice_id: string
          label: string
          paid_at: string | null
          position: number
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          amount_type: string
          amount_value?: number | null
          due_date?: string | null
          due_offset_anchor?: string | null
          due_offset_unit?: string | null
          due_offset_value?: number | null
          id?: string
          invoice_id: string
          label: string
          paid_at?: string | null
          position: number
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          amount_type?: string
          amount_value?: number | null
          due_date?: string | null
          due_offset_anchor?: string | null
          due_offset_unit?: string | null
          due_offset_value?: number | null
          id?: string
          invoice_id?: string
          label?: string
          paid_at?: string | null
          position?: number
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_stages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_template_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_template_id: string
          note: string | null
          position: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_template_id: string
          note?: string | null
          position: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_template_id?: string
          note?: string | null
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_template_items_invoice_template_id_fkey"
            columns: ["invoice_template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_starter: boolean
          name: string
          notes: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_starter?: boolean
          name: string
          notes?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_starter?: boolean
          name?: string
          notes?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          couple_id: string
          created_at: string
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          email_sent_at: string | null
          event_id: string | null
          gst_inclusive: boolean
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_terms: string | null
          share_token: string
          share_token_enabled: boolean
          status: string
          stripe_payment_enabled: boolean
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_rate: number
          title: string
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          email_sent_at?: string | null
          event_id?: string | null
          gst_inclusive?: boolean
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          share_token?: string
          share_token_enabled?: boolean
          status?: string
          stripe_payment_enabled?: boolean
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_rate?: number
          title: string
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          email_sent_at?: string | null
          event_id?: string | null
          gst_inclusive?: boolean
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          share_token?: string
          share_token_enabled?: boolean
          status?: string
          stripe_payment_enabled?: boolean
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_rate?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_capture_forms: {
        Row: {
          allowed_origins: string[]
          capture_token: string
          created_at: string
          enabled: boolean
          id: string
          target_status_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_origins?: string[]
          capture_token?: string
          created_at?: string
          enabled?: boolean
          id?: string
          target_status_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_origins?: string[]
          capture_token?: string
          created_at?: string
          enabled?: boolean
          id?: string
          target_status_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_type_availability_rules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          meeting_type_id: string
          start_time: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          meeting_type_id: string
          start_time: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          meeting_type_id?: string
          start_time?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_type_availability_rules_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_types: {
        Row: {
          active: boolean
          address: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          location_type: string
          max_advance_days: number
          min_notice_hours: number
          name: string
          reminder_enabled: boolean
          share_token: string
          updated_at: string
          user_id: string
          uses_custom_availability: boolean
        }
        Insert: {
          active?: boolean
          address?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          location_type?: string
          max_advance_days?: number
          min_notice_hours?: number
          name: string
          reminder_enabled?: boolean
          share_token?: string
          updated_at?: string
          user_id: string
          uses_custom_availability?: boolean
        }
        Update: {
          active?: boolean
          address?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location_type?: string
          max_advance_days?: number
          min_notice_hours?: number
          name?: string
          reminder_enabled?: boolean
          share_token?: string
          updated_at?: string
          user_id?: string
          uses_custom_availability?: boolean
        }
        Relationships: []
      }
      package_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      package_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          optional: boolean
          package_id: string
          position: number
          quantity: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          optional?: boolean
          package_id: string
          position: number
          quantity?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          optional?: boolean
          package_id?: string
          position?: number
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          archived_at: string | null
          category_id: string | null
          created_at: string
          description: string | null
          fixed_price: number | null
          gst_inclusive: boolean
          id: string
          is_popular: boolean
          is_starter: boolean
          name: string
          notes: string | null
          position: number
          pricing_mode: string
          updated_at: string
          user_id: string
          weekend_loading_percent: number | null
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          fixed_price?: number | null
          gst_inclusive?: boolean
          id?: string
          is_popular?: boolean
          is_starter?: boolean
          name: string
          notes?: string | null
          position?: number
          pricing_mode?: string
          updated_at?: string
          user_id: string
          weekend_loading_percent?: number | null
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          fixed_price?: number | null
          gst_inclusive?: boolean
          id?: string
          is_popular?: boolean
          is_starter?: boolean
          name?: string
          notes?: string | null
          position?: number
          pricing_mode?: string
          updated_at?: string
          user_id?: string
          weekend_loading_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "package_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule_stages: {
        Row: {
          amount_type: string
          amount_value: number | null
          due_offset_anchor: string
          due_offset_days: number
          due_offset_unit: string
          due_offset_value: number
          id: string
          label: string
          position: number
          schedule_id: string
          user_id: string
        }
        Insert: {
          amount_type: string
          amount_value?: number | null
          due_offset_anchor?: string
          due_offset_days?: number
          due_offset_unit?: string
          due_offset_value?: number
          id?: string
          label: string
          position: number
          schedule_id: string
          user_id: string
        }
        Update: {
          amount_type?: string
          amount_value?: number | null
          due_offset_anchor?: string
          due_offset_days?: number
          due_offset_unit?: string
          due_offset_value?: number
          id?: string
          label?: string
          position?: number
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_stages_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      portal_files: {
        Row: {
          couple_id: string
          created_at: string | null
          file_size: number | null
          file_url: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_files_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_people: {
        Row: {
          audio_url: string | null
          category: string
          couple_id: string
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          phonetic: string | null
          position: number
          role: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          category: string
          couple_id: string
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          phonetic?: string | null
          position?: number
          role?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          category?: string
          couple_id?: string
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          phonetic?: string | null
          position?: number
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_people_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_song_categories: {
        Row: {
          couple_id: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          label: string
          position: number
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          label: string
          position?: number
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          label?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_song_categories_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_songs: {
        Row: {
          artist: string | null
          category: string
          couple_id: string
          created_at: string | null
          id: string
          notes: string | null
          position: number
          title: string
          user_id: string
        }
        Insert: {
          artist?: string | null
          category: string
          couple_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          position?: number
          title: string
          user_id: string
        }
        Update: {
          artist?: string | null
          category?: string
          couple_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_songs_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_templates: {
        Row: {
          created_at: string
          description: string | null
          display_mode: string
          id: string
          is_starter: boolean
          name: string
          position: number
          questions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          is_starter?: boolean
          name: string
          position?: number
          questions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          is_starter?: boolean
          name?: string
          position?: number
          questions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scripts: {
        Row: {
          content: Json
          couple_id: string
          created_at: string
          font: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          couple_id: string
          created_at?: string
          font?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          couple_id?: string
          created_at?: string
          font?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          received_at: string
          type: string
        }
        Insert: {
          id: string
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      task_groups: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      task_priorities: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      task_types: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          group_id: string | null
          id: string
          position: number
          priority: string | null
          related_contact_id: string | null
          related_couple_id: string | null
          related_event_id: string | null
          status: string
          task_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          position?: number
          priority?: string | null
          related_contact_id?: string | null
          related_couple_id?: string | null
          related_event_id?: string | null
          status?: string
          task_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          position?: number
          priority?: string | null
          related_contact_id?: string | null
          related_couple_id?: string | null
          related_event_id?: string | null
          status?: string
          task_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_couple_id_fkey"
            columns: ["related_couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_vendor_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      time_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      timeline_items: {
        Row: {
          contact_id: string | null
          created_at: string | null
          description: string | null
          duration_min: number | null
          event_id: string
          id: string
          internal: boolean
          pending_review: boolean
          position: number
          start_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_min?: number | null
          event_id: string
          id?: string
          internal?: boolean
          pending_review?: boolean
          position?: number
          start_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_min?: number | null
          event_id?: string
          id?: string
          internal?: boolean
          pending_review?: boolean
          position?: number
          start_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branding: {
        Row: {
          brand_kits: Json
          branding_blocks: Json | null
          enabled_surfaces: Json
          onboarded_at: string | null
          portal_sections: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_kits?: Json
          branding_blocks?: Json | null
          enabled_surfaces?: Json
          onboarded_at?: string | null
          portal_sections?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_kits?: Json
          branding_blocks?: Json | null
          enabled_surfaces?: Json
          onboarded_at?: string | null
          portal_sections?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_public_settings: {
        Row: {
          couple_profile_tabs_config: Json
          created_at: string
          email_mode: string
          mc_signature_image: string | null
          oauth_access_token_encrypted: string | null
          oauth_connected_at: string | null
          oauth_email: string | null
          oauth_from_name: string | null
          oauth_last_error: string | null
          oauth_provider: string | null
          oauth_refresh_token_encrypted: string | null
          oauth_status: string
          oauth_token_expires_at: string | null
          subdomain: string | null
          time_categories_seeded: boolean
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          couple_profile_tabs_config?: Json
          created_at?: string
          email_mode?: string
          mc_signature_image?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_connected_at?: string | null
          oauth_email?: string | null
          oauth_from_name?: string | null
          oauth_last_error?: string | null
          oauth_provider?: string | null
          oauth_refresh_token_encrypted?: string | null
          oauth_status?: string
          oauth_token_expires_at?: string | null
          subdomain?: string | null
          time_categories_seeded?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          couple_profile_tabs_config?: Json
          created_at?: string
          email_mode?: string
          mc_signature_image?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_connected_at?: string | null
          oauth_email?: string | null
          oauth_from_name?: string | null
          oauth_last_error?: string | null
          oauth_provider?: string | null
          oauth_refresh_token_encrypted?: string | null
          oauth_status?: string
          oauth_token_expires_at?: string | null
          subdomain?: string | null
          time_categories_seeded?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vow_revisions: {
        Row: {
          author: string
          content: string
          created_at: string
          id: string
          user_id: string
          vow_id: string
        }
        Insert: {
          author: string
          content: string
          created_at?: string
          id?: string
          user_id: string
          vow_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          vow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vow_revisions_vow_id_fkey"
            columns: ["vow_id"]
            isOneToOne: false
            referencedRelation: "vows"
            referencedColumns: ["id"]
          },
        ]
      }
      vows: {
        Row: {
          content: string
          couple_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          who: string
        }
        Insert: {
          content?: string
          couple_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          who?: string
        }
        Update: {
          content?: string
          couple_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          who?: string
        }
        Relationships: [
          {
            foreignKeyName: "vows_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _contract_canonical_payload: {
        Args: { p_contract_id: string }
        Returns: string
      }
      _contract_strip_money_mentions: { Args: { node: Json }; Returns: Json }
      _contract_tokenise_role: { Args: { node: Json }; Returns: Json }
      _ip_prefix: { Args: { p_ip: string }; Returns: string }
      _owns_contract: { Args: { p_contract_id: string }; Returns: boolean }
      _owns_couple_or_null: { Args: { p_couple_id: string }; Returns: boolean }
      _owns_meeting_type: {
        Args: { p_meeting_type_id: string }
        Returns: boolean
      }
      _owns_package_or_null: {
        Args: { p_package_id: string }
        Returns: boolean
      }
      _resolve_contract_token: {
        Args: { p_token: string }
        Returns: {
          contract_id: string
          is_legacy: boolean
          signer_id: string
        }[]
      }
      _resolve_portal_couple: {
        Args: { p_token: string }
        Returns: {
          couple_id: string
          owner_id: string
          viewer: string
        }[]
      }
      _user_branding: { Args: { p_user_id: string }; Returns: Json }
      _user_branding_blocks: {
        Args: { p_surface: string; p_user_id: string }
        Returns: Json
      }
      _vendor_role_label: { Args: { meta: Json }; Returns: string }
      admin_user_last_seen: {
        Args: never
        Returns: {
          last_seen: string
          user_id: string
        }[]
      }
      backfill_invoice_payment_stages: { Args: never; Returns: number }
      bookings_due_for_reminder: { Args: never; Returns: Json[] }
      cancel_booking: { Args: { p_manage_token: string }; Returns: Json }
      consume_signer_otp: {
        Args: {
          p_actor_ip?: string
          p_actor_user_agent?: string
          p_otp_id: string
        }
        Returns: Json
      }
      contracts_due_for_reminder: {
        Args: never
        Returns: {
          contract_number: string
          couple_email: string
          couple_id: string
          couple_name: string
          email_sent_at: string
          expires_at: string
          id: string
          last_reminder_at: string
          mc_business_name: string
          reminder_count: number
          share_token: string
          title: string
          user_id: string
        }[]
      }
      decline_contract: {
        Args: {
          p_actor_ip?: string
          p_actor_user_agent?: string
          p_reason: string
          token: string
        }
        Returns: Json
      }
      decline_contract_v2: {
        Args: { p_payload: Json; p_token: string }
        Returns: Json
      }
      delete_portal_file: {
        Args: { p_id: string; p_token: string }
        Returns: undefined
      }
      delete_portal_person: {
        Args: { p_id: string; p_token: string }
        Returns: undefined
      }
      delete_portal_song: {
        Args: { p_id: string; p_token: string }
        Returns: undefined
      }
      delete_portal_timeline_item: {
        Args: { p_id: string; p_token: string }
        Returns: undefined
      }
      delete_portal_vow: {
        Args: { p_id: string; p_token: string }
        Returns: undefined
      }
      emit_automation_event: {
        Args: {
          p_couple_id?: string
          p_event_type: string
          p_payload?: Json
          p_source_id: string
          p_source_table: string
          p_user_id: string
        }
        Returns: string
      }
      emit_contract_audit_event: {
        Args: {
          p_actor: string
          p_actor_ip?: string
          p_actor_user_agent?: string
          p_contract_id: string
          p_decline_reason?: string
          p_event_type: string
          p_reminder_number?: number
          p_revoked_from_status?: string
          p_signer_name_typed?: string
        }
        Returns: undefined
      }
      expire_contracts: { Args: never; Returns: string[] }
      fail_signer_otp: {
        Args: { p_max_attempts: number; p_otp_id: string }
        Returns: Json
      }
      generate_contract_number: { Args: { p_user_id: string }; Returns: string }
      generate_invoice_number: { Args: { p_user_id: string }; Returns: string }
      get_booking_by_manage_token: { Args: { token: string }; Returns: Json }
      get_lead_form: { Args: { token: string }; Returns: Json }
      get_portal_data: { Args: { token: string }; Returns: Json }
      get_portal_packages: { Args: { p_token: string }; Returns: Json }
      get_portal_questionnaires: { Args: { token: string }; Returns: Json }
      get_public_booking_page: { Args: { token: string }; Returns: Json }
      get_public_contract: { Args: { token: string }; Returns: Json }
      get_public_invoice: { Args: { token: string }; Returns: Json }
      get_public_questionnaire: { Args: { token: string }; Returns: Json }
      get_public_timeline: { Args: { token: string }; Returns: Json }
      get_vendor_timeline: { Args: { token: string }; Returns: Json }
      increment_ai_copilot_usage: { Args: never; Returns: number }
      is_own_couple: { Args: { couple_id_value: string }; Returns: boolean }
      is_valid_portal_token: { Args: { token_value: string }; Returns: boolean }
      issue_signer_otp: {
        Args: {
          p_code_hash: string
          p_code_salt: string
          p_token: string
          p_ttl_seconds: number
        }
        Returns: Json
      }
      mark_booking_reminder_sent: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      mark_contract_reminder_sent: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      peek_signer_otp: { Args: { p_token: string }; Returns: Json }
      record_contract_view: {
        Args: {
          p_actor_ip?: string
          p_actor_user_agent?: string
          token: string
        }
        Returns: Json
      }
      reschedule_booking: {
        Args: { p_ends_at: string; p_manage_token: string; p_starts_at: string }
        Returns: Json
      }
      revoke_contract: { Args: { p_contract_id: string }; Returns: Json }
      save_portal_contact: {
        Args: {
          p_category: string
          p_email: string
          p_name: string
          p_notes: string
          p_phone: string
          p_token: string
        }
        Returns: string
      }
      save_portal_couple_details: {
        Args: {
          p_primary_email: string
          p_primary_name: string
          p_primary_phone: string
          p_secondary_email: string
          p_secondary_name: string
          p_secondary_phone: string
          p_token: string
        }
        Returns: undefined
      }
      save_portal_event: {
        Args: { p_date: string; p_id: string; p_token: string; p_venue: string }
        Returns: string
      }
      save_portal_file: {
        Args: {
          p_file_size: number
          p_file_url: string
          p_id: string
          p_name: string
          p_token: string
        }
        Returns: string
      }
      save_portal_package: {
        Args: { p_package_id: string; p_token: string }
        Returns: undefined
      }
      save_portal_person:
        | {
            Args: {
              p_audio_url: string
              p_category: string
              p_full_name: string
              p_id: string
              p_phonetic: string
              p_position: number
              p_role: string
              p_token: string
            }
            Returns: string
          }
        | {
            Args: {
              p_audio_url: string
              p_category: string
              p_full_name: string
              p_id: string
              p_notes?: string
              p_phonetic: string
              p_position: number
              p_role: string
              p_token: string
            }
            Returns: string
          }
        | {
            Args: {
              p_audio_url: string
              p_category: string
              p_email?: string
              p_full_name: string
              p_id: string
              p_notes?: string
              p_phone?: string
              p_phonetic: string
              p_position: number
              p_role: string
              p_token: string
            }
            Returns: string
          }
      save_portal_song: {
        Args: {
          p_artist: string
          p_category: string
          p_id: string
          p_notes: string
          p_position: number
          p_title: string
          p_token: string
        }
        Returns: string
      }
      save_portal_timeline_item: {
        Args: {
          p_description: string
          p_duration_min: number
          p_event_id?: string
          p_id: string
          p_start_time: string
          p_title: string
          p_token: string
        }
        Returns: string
      }
      save_portal_vow: {
        Args: { p_content: string; p_id: string; p_token: string }
        Returns: string
      }
      save_questionnaire_progress: {
        Args: { p_responses: Json; token: string }
        Returns: Json
      }
      seed_default_contract_template: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      seed_default_payment_schedule: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      sign_contract: {
        Args: {
          p_signer_ip: string
          p_signer_name: string
          p_signer_user_agent: string
          token: string
        }
        Returns: Json
      }
      sign_contract_v2: {
        Args: { p_payload: Json; p_token: string }
        Returns: Json
      }
      submit_booking: {
        Args: {
          p_email: string
          p_ends_at: string
          p_name: string
          p_notes?: string
          p_partner_name?: string
          p_phone?: string
          p_starts_at: string
          p_timezone: string
          token: string
        }
        Returns: Json
      }
      submit_lead: {
        Args: { p_payload: Json; p_source_origin?: string; token: string }
        Returns: Json
      }
      submit_questionnaire: {
        Args: { p_responses: Json; token: string }
        Returns: Json
      }
      verify_contract_hash: { Args: { p_hash: string }; Returns: Json }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

