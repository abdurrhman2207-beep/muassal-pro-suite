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
      account_restrictions: {
        Row: {
          disabled: boolean
          reason: string | null
          restricted_at: string
          restricted_by: string | null
          user_id: string
        }
        Insert: {
          disabled?: boolean
          reason?: string | null
          restricted_at?: string
          restricted_by?: string | null
          user_id: string
        }
        Update: {
          disabled?: boolean
          reason?: string | null
          restricted_at?: string
          restricted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          amount: number | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          flagged: boolean
          id: string
          metadata: Json
          reason: string | null
          risk_level: string
          risk_score: number
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          flagged?: boolean
          id?: string
          metadata?: Json
          reason?: string | null
          risk_level?: string
          risk_score?: number
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          flagged?: boolean
          id?: string
          metadata?: Json
          reason?: string | null
          risk_level?: string
          risk_score?: number
          user_id?: string | null
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          payload: Json | null
          priority: string
          status: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json | null
          priority?: string
          status?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          priority?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string
          id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approved_by: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          payload: Json
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          title: string
          type: Database["public"]["Enums"]["approval_type"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          payload?: Json
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          title: string
          type: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          payload?: Json
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          title?: string
          type?: Database["public"]["Enums"]["approval_type"]
          updated_at?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          automation_id: string | null
          created_at: string
          event: Json
          id: string
          result: Json | null
          status: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          event?: Json
          id?: string
          result?: Json | null
          status?: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          event?: Json
          id?: string
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_json: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          rule_json: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rule_json?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rule_json?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_private: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_private?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_private?: boolean
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          channel_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          channel_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          exchange_rate: number
          is_base: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          exchange_rate?: number
          is_base?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          exchange_rate?: number
          is_base?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_kpis: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          formula: string
          id: string
          name: string
          target: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          formula: string
          id?: string
          name: string
          target?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          formula?: string
          id?: string
          name?: string
          target?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      custom_reports: {
        Row: {
          created_at: string
          created_by: string
          definition: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          definition?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          definition?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: string
          notes: string | null
          sale_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method?: string
          notes?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: string
          notes?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          balance: number
          created_at: string
          credit_limit: number
          email: string | null
          id: string
          loyalty_points: number
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          loyalty_points?: number
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          loyalty_points?: number
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          related_entity: string | null
          related_id: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          related_entity?: string | null
          related_id?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          related_entity?: string | null
          related_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          commentary: string | null
          confidence: number | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          period_end: string
          period_start: string
          predicted_value: number
        }
        Insert: {
          commentary?: string | null
          confidence?: number | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          period_end: string
          period_start: string
          predicted_value: number
        }
        Update: {
          commentary?: string | null
          confidence?: number | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          period_end?: string
          period_start?: string
          predicted_value?: number
        }
        Relationships: []
      }
      health_score_snapshots: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          score: number
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          score: number
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          score?: number
        }
        Relationships: []
      }
      owner_mode: {
        Row: {
          enabled: boolean
          enabled_at: string | null
          freeze_discounts: boolean
          freeze_inventory: boolean
          freeze_returns: boolean
          id: boolean
          notes: string | null
          require_approval_discount_pct: number
          require_approval_refund_amount: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          enabled_at?: string | null
          freeze_discounts?: boolean
          freeze_inventory?: boolean
          freeze_returns?: boolean
          id?: boolean
          notes?: string | null
          require_approval_discount_pct?: number
          require_approval_refund_amount?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          enabled_at?: string | null
          freeze_discounts?: boolean
          freeze_inventory?: boolean
          freeze_returns?: boolean
          id?: boolean
          notes?: string | null
          require_approval_discount_pct?: number
          require_approval_refund_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          id: string
          image_url: string | null
          low_stock_threshold: number
          name: string
          notes: string | null
          purchase_price: number
          quantity: number
          sale_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name: string
          notes?: string | null
          purchase_price?: number
          quantity?: number
          sale_price?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          purchase_price?: number
          quantity?: number
          sale_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid: number
          subtotal: number
          supplier_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid?: number
          subtotal?: number
          supplier_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid?: number
          subtotal?: number
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_cost?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount: number
          due_amount: number
          exchange_rate: number
          id: string
          invoice_number: string
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount?: number
          due_amount?: number
          exchange_rate?: number
          id?: string
          invoice_number: string
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          cashier_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount?: number
          due_amount?: number
          exchange_rate?: number
          id?: string
          invoice_number?: string
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          kind: string
          message: string
          metadata: Json
          related_event_id: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          metadata?: Json
          related_event_id?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          metadata?: Json
          related_event_id?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          reference: string | null
        }
        Insert: {
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          reference?: string | null
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string | null
          currency: string
          email: string | null
          id: string
          invoice_prefix: string
          logo_url: string | null
          phone: string | null
          purchase_prefix: string
          store_name: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          currency?: string
          email?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          purchase_prefix?: string
          store_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          currency?: string
          email?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          purchase_prefix?: string
          store_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_entity: string | null
          related_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_entity?: string | null
          related_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_entity?: string | null
          related_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          response: string | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload: Json
          response?: string | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          response?: string | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          secret: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string
          url?: string
        }
        Relationships: []
      }
      white_label_settings: {
        Row: {
          brand_name: string
          custom_domain: string | null
          id: string
          logo_url: string | null
          primary_color: string
          updated_at: string
        }
        Insert: {
          brand_name?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_business_health: { Args: never; Returns: Json }
      create_purchase: {
        Args: { _items: Json; _notes: string; _supplier_id: string }
        Returns: string
      }
      create_sale:
        | {
            Args: {
              _customer_id: string
              _discount: number
              _items: Json
              _payment: Database["public"]["Enums"]["payment_method"]
              _tax: number
            }
            Returns: string
          }
        | {
            Args: {
              _currency?: string
              _customer_id: string
              _discount: number
              _exchange_rate?: number
              _items: Json
              _paid_amount?: number
              _payment: Database["public"]["Enums"]["payment_method"]
              _tax: number
            }
            Returns: string
          }
      employee_trust_scores: {
        Args: never
        Returns: {
          avg_risk: number
          events: number
          flagged: number
          full_name: string
          trust_score: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _amount: number
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _type: string
        }
        Returns: string
      }
      record_customer_payment: {
        Args: {
          _amount: number
          _customer_id: string
          _method?: string
          _notes?: string
          _sale_id: string
        }
        Returns: string
      }
      record_health_snapshot: { Args: never; Returns: string }
      store_risk_score: { Args: never; Returns: Json }
    }
    Enums: {
      adjustment_type:
        | "manual"
        | "damage"
        | "gift"
        | "transfer_in"
        | "transfer_out"
        | "count"
      app_role: "admin" | "cashier"
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      approval_type:
        | "discount"
        | "purchase"
        | "return"
        | "price_change"
        | "refund"
      payment_method: "cash" | "card" | "transfer"
      sale_status: "paid" | "partial" | "credit" | "void"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
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
      adjustment_type: [
        "manual",
        "damage",
        "gift",
        "transfer_in",
        "transfer_out",
        "count",
      ],
      app_role: ["admin", "cashier"],
      approval_status: ["pending", "approved", "rejected", "cancelled"],
      approval_type: [
        "discount",
        "purchase",
        "return",
        "price_change",
        "refund",
      ],
      payment_method: ["cash", "card", "transfer"],
      sale_status: ["paid", "partial", "credit", "void"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
    },
  },
} as const
