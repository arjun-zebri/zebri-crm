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
      contract_templates: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          id: string
          is_default: boolean
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
          email_sent_at: string | null
          expires_at: string | null
          id: string
          last_reminder_at: string | null
          locked_content: Json | null
          locked_content_html: string | null
          mc_signature_name: string | null
          notes: string | null
          quote_id: string | null
          reminder_count: number
          share_token: string
          share_token_enabled: boolean
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          status: string
          title: string
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
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          locked_content?: Json | null
          locked_content_html?: string | null
          mc_signature_name?: string | null
          notes?: string | null
          quote_id?: string | null
          reminder_count?: number
          share_token?: string
          share_token_enabled?: boolean
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: string
          title: string
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
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          locked_content?: Json | null
          locked_content_html?: string | null
          mc_signature_name?: string | null
          notes?: string | null
          quote_id?: string | null
          reminder_count?: number
          share_token?: string
          share_token_enabled?: boolean
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: string
          title?: string
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
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          status?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: []
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
          id: string
          share_token: string | null
          share_token_enabled: boolean
          status: string
          timeline_notes: string | null
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
          id?: string
          share_token?: string | null
          share_token_enabled?: boolean
          status?: string
          timeline_notes?: string | null
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
          id?: string
          share_token?: string | null
          share_token_enabled?: boolean
          status?: string
          timeline_notes?: string | null
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
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
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
      invoices: {
        Row: {
          couple_id: string
          created_at: string
          deposit_due_date: string | null
          deposit_paid_at: string | null
          deposit_percent: number | null
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          email_sent_at: string | null
          event_id: string | null
          final_due_date: string | null
          final_paid_at: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_terms: string | null
          quote_id: string | null
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
          deposit_due_date?: string | null
          deposit_paid_at?: string | null
          deposit_percent?: number | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          email_sent_at?: string | null
          event_id?: string | null
          final_due_date?: string | null
          final_paid_at?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          quote_id?: string | null
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
          deposit_due_date?: string | null
          deposit_paid_at?: string | null
          deposit_percent?: number | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          email_sent_at?: string | null
          event_id?: string | null
          final_due_date?: string | null
          final_paid_at?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          quote_id?: string | null
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
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
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
      quote_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          position: number
          quote_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          position: number
          quote_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          position?: number
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_template_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          position: number
          template_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          position: number
          template_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          position?: number
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
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
          name?: string
          notes?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          couple_id: string
          created_at: string
          discount_type: string | null
          discount_value: number | null
          email_sent_at: string | null
          expires_at: string | null
          id: string
          notes: string | null
          quote_number: string
          share_token: string
          share_token_enabled: boolean
          status: string
          subtotal: number
          tax_rate: number
          title: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          couple_id: string
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          quote_number: string
          share_token?: string
          share_token_enabled?: boolean
          status?: string
          subtotal?: number
          tax_rate?: number
          title: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          couple_id?: string
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          quote_number?: string
          share_token?: string
          share_token_enabled?: boolean
          status?: string
          subtotal?: number
          tax_rate?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_couple_id_fkey"
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
      timeline_items: {
        Row: {
          contact_id: string | null
          created_at: string | null
          description: string | null
          duration_min: number | null
          event_id: string
          id: string
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
      timeline_template_items: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number | null
          id: string
          position: number
          start_time: string | null
          template_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          position?: number
          start_time?: string | null
          template_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          position?: number
          start_time?: string | null
          template_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "timeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      user_branding: {
        Row: {
          brand_kits: Json
          branding_blocks: Json | null
          portal_sections: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_kits?: Json
          branding_blocks?: Json | null
          portal_sections?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_kits?: Json
          branding_blocks?: Json | null
          portal_sections?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _user_branding: { Args: { p_user_id: string }; Returns: Json }
      _user_branding_blocks: {
        Args: { p_surface: string; p_user_id: string }
        Returns: Json
      }
      accept_quote: { Args: { token: string }; Returns: Json }
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
        Args: { p_reason: string; token: string }
        Returns: Json
      }
      decline_quote: { Args: { token: string }; Returns: Json }
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
      expire_contracts: { Args: never; Returns: string[] }
      generate_contract_number: { Args: { p_user_id: string }; Returns: string }
      generate_invoice_number: { Args: { p_user_id: string }; Returns: string }
      generate_quote_number: { Args: { p_user_id: string }; Returns: string }
      get_portal_data: { Args: { token: string }; Returns: Json }
      get_public_contract: { Args: { token: string }; Returns: Json }
      get_public_invoice: { Args: { token: string }; Returns: Json }
      get_public_quote: { Args: { token: string }; Returns: Json }
      get_public_timeline: { Args: { token: string }; Returns: Json }
      get_vendor_timeline: { Args: { token: string }; Returns: Json }
      is_own_couple: { Args: { couple_id_value: string }; Returns: boolean }
      is_valid_portal_token: { Args: { token_value: string }; Returns: boolean }
      mark_contract_reminder_sent: {
        Args: { p_contract_id: string }
        Returns: undefined
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
          p_id: string
          p_start_time: string
          p_title: string
          p_token: string
        }
        Returns: string
      }
      seed_default_contract_template: {
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

