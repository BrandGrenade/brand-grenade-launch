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
      brand_asset_rules: {
        Row: {
          brand_key: string
          brand_name: string
          colours: string | null
          created_at: string
          id: string
          legal_lines: string | null
          logo_references: string | null
          notes: string | null
          packaging_rules: string | null
          typography: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_key: string
          brand_name: string
          colours?: string | null
          created_at?: string
          id?: string
          legal_lines?: string | null
          logo_references?: string | null
          notes?: string | null
          packaging_rules?: string | null
          typography?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_key?: string
          brand_name?: string
          colours?: string | null
          created_at?: string
          id?: string
          legal_lines?: string | null
          logo_references?: string | null
          notes?: string | null
          packaging_rules?: string | null
          typography?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_room_workspaces: {
        Row: {
          brand_name: string
          category: string
          created_at: string
          diagnosis: Json | null
          id: string
          raw_brief: string
          relevance: Json | null
          selected_frame: string | null
          selected_tension_index: number | null
          status: string
          supporting_evidence: Json
          tensions: Json | null
          truths: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_name?: string
          category?: string
          created_at?: string
          diagnosis?: Json | null
          id?: string
          raw_brief?: string
          relevance?: Json | null
          selected_frame?: string | null
          selected_tension_index?: number | null
          status?: string
          supporting_evidence?: Json
          tensions?: Json | null
          truths?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string
          category?: string
          created_at?: string
          diagnosis?: Json | null
          id?: string
          raw_brief?: string
          relevance?: Json | null
          selected_frame?: string | null
          selected_tension_index?: number | null
          status?: string
          supporting_evidence?: Json
          tensions?: Json | null
          truths?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          company: string
          created_at: string
          email: string
          email_error: string | null
          email_sent: boolean
          id: string
          message: string | null
          name: string
        }
        Insert: {
          company: string
          created_at?: string
          email: string
          email_error?: string | null
          email_sent?: boolean
          id?: string
          message?: string | null
          name: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          email_error?: string | null
          email_sent?: boolean
          id?: string
          message?: string | null
          name?: string
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
      intelligence_sessions: {
        Row: {
          additional_context: string | null
          brand_name: string
          category: string | null
          completed_at: string | null
          created_at: string
          current_layer: number
          final_report: string | null
          handoff_payload: Json | null
          handoff_written_at: string | null
          id: string
          input_audience_segmentation: string | null
          input_bg_intel_pack: string | null
          input_brand_health: string | null
          input_competitive_audit: string | null
          input_cultural_trends: string | null
          input_files: Json | null
          input_primary_consumer: string | null
          last_error: string | null
          layer_1_output: string | null
          layer_10_output: string | null
          layer_2_output: string | null
          layer_3_output: string | null
          layer_4_output: string | null
          layer_5_output: string | null
          layer_6_output: string | null
          layer_7_output: string | null
          layer_8_output: string | null
          layer_9_output: string | null
          report_metadata: Json | null
          retry_count: number
          stage_status: string | null
          started_at: string | null
          status: string
          territory_input: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_context?: string | null
          brand_name: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          current_layer?: number
          final_report?: string | null
          handoff_payload?: Json | null
          handoff_written_at?: string | null
          id?: string
          input_audience_segmentation?: string | null
          input_bg_intel_pack?: string | null
          input_brand_health?: string | null
          input_competitive_audit?: string | null
          input_cultural_trends?: string | null
          input_files?: Json | null
          input_primary_consumer?: string | null
          last_error?: string | null
          layer_1_output?: string | null
          layer_10_output?: string | null
          layer_2_output?: string | null
          layer_3_output?: string | null
          layer_4_output?: string | null
          layer_5_output?: string | null
          layer_6_output?: string | null
          layer_7_output?: string | null
          layer_8_output?: string | null
          layer_9_output?: string | null
          report_metadata?: Json | null
          retry_count?: number
          stage_status?: string | null
          started_at?: string | null
          status?: string
          territory_input?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_context?: string | null
          brand_name?: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          current_layer?: number
          final_report?: string | null
          handoff_payload?: Json | null
          handoff_written_at?: string | null
          id?: string
          input_audience_segmentation?: string | null
          input_bg_intel_pack?: string | null
          input_brand_health?: string | null
          input_competitive_audit?: string | null
          input_cultural_trends?: string | null
          input_files?: Json | null
          input_primary_consumer?: string | null
          last_error?: string | null
          layer_1_output?: string | null
          layer_10_output?: string | null
          layer_2_output?: string | null
          layer_3_output?: string | null
          layer_4_output?: string | null
          layer_5_output?: string | null
          layer_6_output?: string | null
          layer_7_output?: string | null
          layer_8_output?: string | null
          layer_9_output?: string | null
          report_metadata?: Json | null
          retry_count?: number
          stage_status?: string | null
          started_at?: string | null
          status?: string
          territory_input?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      preflight_checks: {
        Row: {
          check_type: string
          completed_at: string | null
          created_at: string
          id: string
          overall_result: string | null
          override_reason: string | null
          override_session_id: string | null
          override_timestamp: string | null
          override_used: boolean
          started_at: string
          started_by: string | null
          status: string
          tier_one_results: Json | null
          tier_two_results: Json | null
          updated_at: string
        }
        Insert: {
          check_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          overall_result?: string | null
          override_reason?: string | null
          override_session_id?: string | null
          override_timestamp?: string | null
          override_used?: boolean
          started_at?: string
          started_by?: string | null
          status?: string
          tier_one_results?: Json | null
          tier_two_results?: Json | null
          updated_at?: string
        }
        Update: {
          check_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          overall_result?: string | null
          override_reason?: string | null
          override_session_id?: string | null
          override_timestamp?: string | null
          override_used?: boolean
          started_at?: string
          started_by?: string | null
          status?: string
          tier_one_results?: Json | null
          tier_two_results?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preflight_checks_override_session_id_fkey"
            columns: ["override_session_id"]
            isOneToOne: false
            referencedRelation: "brand_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preflight_checks_override_session_id_fkey"
            columns: ["override_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      repositories: {
        Row: {
          created_at: string
          intro: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          intro?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          intro?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      repository_access_log: {
        Row: {
          created_at: string
          document_id: string | null
          document_title: string | null
          event_type: string
          id: string
          ip_address: string | null
          repository_slug: string
          user_agent: string | null
          visitor_id: string | null
          visitor_name: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          document_title?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          repository_slug: string
          user_agent?: string | null
          visitor_id?: string | null
          visitor_name?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          document_title?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          repository_slug?: string
          user_agent?: string | null
          visitor_id?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repository_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "repository_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repository_access_log_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "repository_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_documents: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          file_type: string
          id: string
          repository_slug: string
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          file_type: string
          id?: string
          repository_slug: string
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          file_type?: string
          id?: string
          repository_slug?: string
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_documents_repository_slug_fkey"
            columns: ["repository_slug"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["slug"]
          },
        ]
      }
      repository_visitors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          organisation: string | null
          password_hash: string
          plaintext_password: string | null
          repository_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organisation?: string | null
          password_hash: string
          plaintext_password?: string | null
          repository_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organisation?: string | null
          password_hash?: string
          plaintext_password?: string | null
          repository_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_visitors_repository_slug_fkey"
            columns: ["repository_slug"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["slug"]
          },
        ]
      }
      saved_briefs: {
        Row: {
          brand_name: string
          brief_fields: Json | null
          brief_id: string
          brief_text: string
          category: string
          created_at: string
          user_id: string
        }
        Insert: {
          brand_name: string
          brief_fields?: Json | null
          brief_id?: string
          brief_text?: string
          category?: string
          created_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string
          brief_fields?: Json | null
          brief_id?: string
          brief_text?: string
          category?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_collaborators: {
        Row: {
          claimed_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_collaborators_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brand_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_collaborators_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          brand_audience_relationship: string | null
          brand_constraints: string | null
          brand_intel_assets: Json | null
          brand_intel_confirmed: boolean
          brand_intel_tone: string | null
          brand_intel_type: string | null
          brand_intel_values: string | null
          brand_intelligence: Json | null
          brand_name: string
          brand_organisational_context: string | null
          brand_positioning: string | null
          brand_product_truth: string | null
          brand_tone_of_voice: string | null
          brief_text: string
          brief_versions: Json
          category: string
          checkpoint_a_confirmed: boolean
          checkpoint_a_confirmed_at: string | null
          checkpoint_a_notes: string | null
          checkpoint_b_confirmed: boolean
          checkpoint_b_confirmed_at: string | null
          checkpoint_b_notes: string | null
          checkpoint_c_confirmed: boolean
          checkpoint_c_confirmed_at: string | null
          checkpoint_c_notes: string | null
          checkpoint_d_confirmed: boolean
          checkpoint_d_confirmed_at: string | null
          checkpoint_d_notes: string | null
          checkpoint_e_confirmed: boolean
          checkpoint_e_confirmed_at: string | null
          checkpoint_e_notes: string | null
          checkpoint_f_confirmed: boolean
          checkpoint_f_confirmed_at: string | null
          checkpoint_f_notes: string | null
          created_at: string
          current_stage: number
          dev_mode: boolean
          doc_agency_sections: Json | null
          doc_agency_status: string | null
          doc_agency_status_at: string | null
          doc_agency_url: string | null
          doc_consulting_sections: Json | null
          doc_consulting_status: string | null
          doc_consulting_status_at: string | null
          doc_consulting_url: string | null
          doc_workshop_sections: Json | null
          doc_workshop_status: string | null
          doc_workshop_status_at: string | null
          doc_workshop_url: string | null
          id: string
          interrupted_at: string | null
          interrupted_stage: number | null
          is_preflight_test: boolean
          last_heartbeat_at: string | null
          loc_classifier_rationale: string | null
          loc_decision_packages: Json | null
          loc_engine_outputs: Json | null
          loc_error: string | null
          loc_generated_at: string | null
          loc_retry_count: number
          loc_status: string | null
          loc_task_runner_up: string | null
          loc_task_type: string | null
          loc_validation: Json | null
          locked_big_idea: string | null
          locked_big_idea_at: string | null
          locked_big_idea_lens: string | null
          locked_big_idea_run_id: string | null
          locked_campaign_line: string | null
          phase_2_current_stage: string
          phase_2_status: string
          retry_count: number
          retry_status: string | null
          selected_format: string | null
          selected_loc_expression: string | null
          selected_smp: string | null
          selected_smp_field_name: string | null
          selection_engine: string | null
          selection_rationale: Json | null
          selection_rationale_1: string | null
          selection_rationale_2: string | null
          selection_rationale_3: string | null
          selection_rationale_4: string | null
          selection_rationale_5: string | null
          selection_rationale_6: string | null
          selection_source: string | null
          stage_1_error: string | null
          stage_1_output: string | null
          stage_1_tension_score: number | null
          stage_10_error: string | null
          stage_10_output: string | null
          stage_11_error: string | null
          stage_11_output: string | null
          stage_12_error: string | null
          stage_12_output: string | null
          stage_12_smps: Json | null
          stage_13_error: string | null
          stage_13_output: string | null
          stage_13_verdict: string | null
          stage_13b_error: string | null
          stage_13b_output: string | null
          stage_14_error: string | null
          stage_14_output: string | null
          stage_14b_error: string | null
          stage_14b_output: string | null
          stage_14c_error: string | null
          stage_14c_output: string | null
          stage_15_clearance_status: string | null
          stage_15_error: string | null
          stage_15_output: string | null
          stage_16_agency_output: string | null
          stage_16_consulting_output: string | null
          stage_16_error: string | null
          stage_16_format: string | null
          stage_16_vision_output: string | null
          stage_16_workshop_output: string | null
          stage_17_error: string | null
          stage_17_output: string | null
          stage_17_selected_territory: string | null
          stage_17b_error: string | null
          stage_17b_output: string | null
          stage_18_detonation_line: string | null
          stage_18_error: string | null
          stage_18_output: string | null
          stage_18_selected_detonation: string | null
          stage_19_error: string | null
          stage_19_output: string | null
          stage_1b_output: string | null
          stage_1b_required: boolean
          stage_2_error: string | null
          stage_2_output: string | null
          stage_20_approved: boolean
          stage_20_error: string | null
          stage_20_output: string | null
          stage_20b_audience_input: Json | null
          stage_20b_error: string | null
          stage_20b_output: string | null
          stage_20l_approved: boolean
          stage_20l_error: string | null
          stage_20l_medium: string | null
          stage_20l_output: string | null
          stage_21_error: string | null
          stage_21_fidelity: Json | null
          stage_21_outputs: Json | null
          stage_22_brand_architecture: string | null
          stage_22_distinctive_assets: string | null
          stage_22_error: string | null
          stage_22_output: string | null
          stage_3_error: string | null
          stage_3_output: string | null
          stage_4_error: string | null
          stage_4_output: string | null
          stage_4b_error: string | null
          stage_4b_output: string | null
          stage_5_error: string | null
          stage_5_output: string | null
          stage_6_error: string | null
          stage_6_output: string | null
          stage_6_status: string | null
          stage_7_error: string | null
          stage_7_output: string | null
          stage_7_territory_count: number | null
          stage_8_error: string | null
          stage_8_feedback: string | null
          stage_8_output: string | null
          stage_9_error: string | null
          stage_9_leftofcentre_output: string | null
          stage_9_output: string | null
          stage_amendments: Json
          stage_started_at: string | null
          stage_status: string | null
          status: string
          strategic_mode: string
          strategy_signoff_confirmed: boolean
          strategy_signoff_confirmed_at: string | null
          strategy_signoff_stop: boolean
          strategy_signoff_stop_at: string | null
          stream_last_delta_at: string | null
          truth_consumer: string | null
          truth_cultural: string | null
          truth_cultural_confidence: string | null
          truth_cultural_confirmed: boolean
          truth_product: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          brand_audience_relationship?: string | null
          brand_constraints?: string | null
          brand_intel_assets?: Json | null
          brand_intel_confirmed?: boolean
          brand_intel_tone?: string | null
          brand_intel_type?: string | null
          brand_intel_values?: string | null
          brand_intelligence?: Json | null
          brand_name: string
          brand_organisational_context?: string | null
          brand_positioning?: string | null
          brand_product_truth?: string | null
          brand_tone_of_voice?: string | null
          brief_text: string
          brief_versions?: Json
          category: string
          checkpoint_a_confirmed?: boolean
          checkpoint_a_confirmed_at?: string | null
          checkpoint_a_notes?: string | null
          checkpoint_b_confirmed?: boolean
          checkpoint_b_confirmed_at?: string | null
          checkpoint_b_notes?: string | null
          checkpoint_c_confirmed?: boolean
          checkpoint_c_confirmed_at?: string | null
          checkpoint_c_notes?: string | null
          checkpoint_d_confirmed?: boolean
          checkpoint_d_confirmed_at?: string | null
          checkpoint_d_notes?: string | null
          checkpoint_e_confirmed?: boolean
          checkpoint_e_confirmed_at?: string | null
          checkpoint_e_notes?: string | null
          checkpoint_f_confirmed?: boolean
          checkpoint_f_confirmed_at?: string | null
          checkpoint_f_notes?: string | null
          created_at?: string
          current_stage?: number
          dev_mode?: boolean
          doc_agency_sections?: Json | null
          doc_agency_status?: string | null
          doc_agency_status_at?: string | null
          doc_agency_url?: string | null
          doc_consulting_sections?: Json | null
          doc_consulting_status?: string | null
          doc_consulting_status_at?: string | null
          doc_consulting_url?: string | null
          doc_workshop_sections?: Json | null
          doc_workshop_status?: string | null
          doc_workshop_status_at?: string | null
          doc_workshop_url?: string | null
          id?: string
          interrupted_at?: string | null
          interrupted_stage?: number | null
          is_preflight_test?: boolean
          last_heartbeat_at?: string | null
          loc_classifier_rationale?: string | null
          loc_decision_packages?: Json | null
          loc_engine_outputs?: Json | null
          loc_error?: string | null
          loc_generated_at?: string | null
          loc_retry_count?: number
          loc_status?: string | null
          loc_task_runner_up?: string | null
          loc_task_type?: string | null
          loc_validation?: Json | null
          locked_big_idea?: string | null
          locked_big_idea_at?: string | null
          locked_big_idea_lens?: string | null
          locked_big_idea_run_id?: string | null
          locked_campaign_line?: string | null
          phase_2_current_stage?: string
          phase_2_status?: string
          retry_count?: number
          retry_status?: string | null
          selected_format?: string | null
          selected_loc_expression?: string | null
          selected_smp?: string | null
          selected_smp_field_name?: string | null
          selection_engine?: string | null
          selection_rationale?: Json | null
          selection_rationale_1?: string | null
          selection_rationale_2?: string | null
          selection_rationale_3?: string | null
          selection_rationale_4?: string | null
          selection_rationale_5?: string | null
          selection_rationale_6?: string | null
          selection_source?: string | null
          stage_1_error?: string | null
          stage_1_output?: string | null
          stage_1_tension_score?: number | null
          stage_10_error?: string | null
          stage_10_output?: string | null
          stage_11_error?: string | null
          stage_11_output?: string | null
          stage_12_error?: string | null
          stage_12_output?: string | null
          stage_12_smps?: Json | null
          stage_13_error?: string | null
          stage_13_output?: string | null
          stage_13_verdict?: string | null
          stage_13b_error?: string | null
          stage_13b_output?: string | null
          stage_14_error?: string | null
          stage_14_output?: string | null
          stage_14b_error?: string | null
          stage_14b_output?: string | null
          stage_14c_error?: string | null
          stage_14c_output?: string | null
          stage_15_clearance_status?: string | null
          stage_15_error?: string | null
          stage_15_output?: string | null
          stage_16_agency_output?: string | null
          stage_16_consulting_output?: string | null
          stage_16_error?: string | null
          stage_16_format?: string | null
          stage_16_vision_output?: string | null
          stage_16_workshop_output?: string | null
          stage_17_error?: string | null
          stage_17_output?: string | null
          stage_17_selected_territory?: string | null
          stage_17b_error?: string | null
          stage_17b_output?: string | null
          stage_18_detonation_line?: string | null
          stage_18_error?: string | null
          stage_18_output?: string | null
          stage_18_selected_detonation?: string | null
          stage_19_error?: string | null
          stage_19_output?: string | null
          stage_1b_output?: string | null
          stage_1b_required?: boolean
          stage_2_error?: string | null
          stage_2_output?: string | null
          stage_20_approved?: boolean
          stage_20_error?: string | null
          stage_20_output?: string | null
          stage_20b_audience_input?: Json | null
          stage_20b_error?: string | null
          stage_20b_output?: string | null
          stage_20l_approved?: boolean
          stage_20l_error?: string | null
          stage_20l_medium?: string | null
          stage_20l_output?: string | null
          stage_21_error?: string | null
          stage_21_fidelity?: Json | null
          stage_21_outputs?: Json | null
          stage_22_brand_architecture?: string | null
          stage_22_distinctive_assets?: string | null
          stage_22_error?: string | null
          stage_22_output?: string | null
          stage_3_error?: string | null
          stage_3_output?: string | null
          stage_4_error?: string | null
          stage_4_output?: string | null
          stage_4b_error?: string | null
          stage_4b_output?: string | null
          stage_5_error?: string | null
          stage_5_output?: string | null
          stage_6_error?: string | null
          stage_6_output?: string | null
          stage_6_status?: string | null
          stage_7_error?: string | null
          stage_7_output?: string | null
          stage_7_territory_count?: number | null
          stage_8_error?: string | null
          stage_8_feedback?: string | null
          stage_8_output?: string | null
          stage_9_error?: string | null
          stage_9_leftofcentre_output?: string | null
          stage_9_output?: string | null
          stage_amendments?: Json
          stage_started_at?: string | null
          stage_status?: string | null
          status?: string
          strategic_mode?: string
          strategy_signoff_confirmed?: boolean
          strategy_signoff_confirmed_at?: string | null
          strategy_signoff_stop?: boolean
          strategy_signoff_stop_at?: string | null
          stream_last_delta_at?: string | null
          truth_consumer?: string | null
          truth_cultural?: string | null
          truth_cultural_confidence?: string | null
          truth_cultural_confirmed?: boolean
          truth_product?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          brand_audience_relationship?: string | null
          brand_constraints?: string | null
          brand_intel_assets?: Json | null
          brand_intel_confirmed?: boolean
          brand_intel_tone?: string | null
          brand_intel_type?: string | null
          brand_intel_values?: string | null
          brand_intelligence?: Json | null
          brand_name?: string
          brand_organisational_context?: string | null
          brand_positioning?: string | null
          brand_product_truth?: string | null
          brand_tone_of_voice?: string | null
          brief_text?: string
          brief_versions?: Json
          category?: string
          checkpoint_a_confirmed?: boolean
          checkpoint_a_confirmed_at?: string | null
          checkpoint_a_notes?: string | null
          checkpoint_b_confirmed?: boolean
          checkpoint_b_confirmed_at?: string | null
          checkpoint_b_notes?: string | null
          checkpoint_c_confirmed?: boolean
          checkpoint_c_confirmed_at?: string | null
          checkpoint_c_notes?: string | null
          checkpoint_d_confirmed?: boolean
          checkpoint_d_confirmed_at?: string | null
          checkpoint_d_notes?: string | null
          checkpoint_e_confirmed?: boolean
          checkpoint_e_confirmed_at?: string | null
          checkpoint_e_notes?: string | null
          checkpoint_f_confirmed?: boolean
          checkpoint_f_confirmed_at?: string | null
          checkpoint_f_notes?: string | null
          created_at?: string
          current_stage?: number
          dev_mode?: boolean
          doc_agency_sections?: Json | null
          doc_agency_status?: string | null
          doc_agency_status_at?: string | null
          doc_agency_url?: string | null
          doc_consulting_sections?: Json | null
          doc_consulting_status?: string | null
          doc_consulting_status_at?: string | null
          doc_consulting_url?: string | null
          doc_workshop_sections?: Json | null
          doc_workshop_status?: string | null
          doc_workshop_status_at?: string | null
          doc_workshop_url?: string | null
          id?: string
          interrupted_at?: string | null
          interrupted_stage?: number | null
          is_preflight_test?: boolean
          last_heartbeat_at?: string | null
          loc_classifier_rationale?: string | null
          loc_decision_packages?: Json | null
          loc_engine_outputs?: Json | null
          loc_error?: string | null
          loc_generated_at?: string | null
          loc_retry_count?: number
          loc_status?: string | null
          loc_task_runner_up?: string | null
          loc_task_type?: string | null
          loc_validation?: Json | null
          locked_big_idea?: string | null
          locked_big_idea_at?: string | null
          locked_big_idea_lens?: string | null
          locked_big_idea_run_id?: string | null
          locked_campaign_line?: string | null
          phase_2_current_stage?: string
          phase_2_status?: string
          retry_count?: number
          retry_status?: string | null
          selected_format?: string | null
          selected_loc_expression?: string | null
          selected_smp?: string | null
          selected_smp_field_name?: string | null
          selection_engine?: string | null
          selection_rationale?: Json | null
          selection_rationale_1?: string | null
          selection_rationale_2?: string | null
          selection_rationale_3?: string | null
          selection_rationale_4?: string | null
          selection_rationale_5?: string | null
          selection_rationale_6?: string | null
          selection_source?: string | null
          stage_1_error?: string | null
          stage_1_output?: string | null
          stage_1_tension_score?: number | null
          stage_10_error?: string | null
          stage_10_output?: string | null
          stage_11_error?: string | null
          stage_11_output?: string | null
          stage_12_error?: string | null
          stage_12_output?: string | null
          stage_12_smps?: Json | null
          stage_13_error?: string | null
          stage_13_output?: string | null
          stage_13_verdict?: string | null
          stage_13b_error?: string | null
          stage_13b_output?: string | null
          stage_14_error?: string | null
          stage_14_output?: string | null
          stage_14b_error?: string | null
          stage_14b_output?: string | null
          stage_14c_error?: string | null
          stage_14c_output?: string | null
          stage_15_clearance_status?: string | null
          stage_15_error?: string | null
          stage_15_output?: string | null
          stage_16_agency_output?: string | null
          stage_16_consulting_output?: string | null
          stage_16_error?: string | null
          stage_16_format?: string | null
          stage_16_vision_output?: string | null
          stage_16_workshop_output?: string | null
          stage_17_error?: string | null
          stage_17_output?: string | null
          stage_17_selected_territory?: string | null
          stage_17b_error?: string | null
          stage_17b_output?: string | null
          stage_18_detonation_line?: string | null
          stage_18_error?: string | null
          stage_18_output?: string | null
          stage_18_selected_detonation?: string | null
          stage_19_error?: string | null
          stage_19_output?: string | null
          stage_1b_output?: string | null
          stage_1b_required?: boolean
          stage_2_error?: string | null
          stage_2_output?: string | null
          stage_20_approved?: boolean
          stage_20_error?: string | null
          stage_20_output?: string | null
          stage_20b_audience_input?: Json | null
          stage_20b_error?: string | null
          stage_20b_output?: string | null
          stage_20l_approved?: boolean
          stage_20l_error?: string | null
          stage_20l_medium?: string | null
          stage_20l_output?: string | null
          stage_21_error?: string | null
          stage_21_fidelity?: Json | null
          stage_21_outputs?: Json | null
          stage_22_brand_architecture?: string | null
          stage_22_distinctive_assets?: string | null
          stage_22_error?: string | null
          stage_22_output?: string | null
          stage_3_error?: string | null
          stage_3_output?: string | null
          stage_4_error?: string | null
          stage_4_output?: string | null
          stage_4b_error?: string | null
          stage_4b_output?: string | null
          stage_5_error?: string | null
          stage_5_output?: string | null
          stage_6_error?: string | null
          stage_6_output?: string | null
          stage_6_status?: string | null
          stage_7_error?: string | null
          stage_7_output?: string | null
          stage_7_territory_count?: number | null
          stage_8_error?: string | null
          stage_8_feedback?: string | null
          stage_8_output?: string | null
          stage_9_error?: string | null
          stage_9_leftofcentre_output?: string | null
          stage_9_output?: string | null
          stage_amendments?: Json
          stage_started_at?: string | null
          stage_status?: string | null
          status?: string
          strategic_mode?: string
          strategy_signoff_confirmed?: boolean
          strategy_signoff_confirmed_at?: string | null
          strategy_signoff_stop?: boolean
          strategy_signoff_stop_at?: string | null
          stream_last_delta_at?: string | null
          truth_consumer?: string | null
          truth_cultural?: string | null
          truth_cultural_confidence?: string | null
          truth_cultural_confirmed?: boolean
          truth_product?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stimulus_cross_refs: {
        Row: {
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          id: string
          orchestration_id: string
          prompt_id: string
          rationale: string
          registry_version: number
          signature_id: string | null
          source_direction_id: string | null
          status: string
          suggestion: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          id?: string
          orchestration_id: string
          prompt_id: string
          rationale?: string
          registry_version?: number
          signature_id?: string | null
          source_direction_id?: string | null
          status?: string
          suggestion: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          id?: string
          orchestration_id?: string
          prompt_id?: string
          rationale?: string
          registry_version?: number
          signature_id?: string | null
          source_direction_id?: string | null
          status?: string
          suggestion?: string
        }
        Relationships: [
          {
            foreignKeyName: "stimulus_cross_refs_orchestration_id_fkey"
            columns: ["orchestration_id"]
            isOneToOne: false
            referencedRelation: "stimulus_orchestrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_cross_refs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "stimulus_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_cross_refs_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "stimulus_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      stimulus_directions: {
        Row: {
          campaign_line: string | null
          created_at: string
          direction: string
          error: string | null
          gate_one_approved: boolean
          gate_one_approved_at: string | null
          gate_one_notes: string | null
          gate_one_snapshot: Json | null
          id: string
          instinct_brief: string | null
          lens_id: string
          lens_name: string
          line_check: Json | null
          rated_at: string | null
          rating_error: string | null
          rating_status: string
          ratings: Json | null
          rationale: string | null
          revise_count: number
          revise_notes: string | null
          run_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          campaign_line?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          gate_one_approved?: boolean
          gate_one_approved_at?: string | null
          gate_one_notes?: string | null
          gate_one_snapshot?: Json | null
          id?: string
          instinct_brief?: string | null
          lens_id: string
          lens_name: string
          line_check?: Json | null
          rated_at?: string | null
          rating_error?: string | null
          rating_status?: string
          ratings?: Json | null
          rationale?: string | null
          revise_count?: number
          revise_notes?: string | null
          run_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_line?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          gate_one_approved?: boolean
          gate_one_approved_at?: string | null
          gate_one_notes?: string | null
          gate_one_snapshot?: Json | null
          id?: string
          instinct_brief?: string | null
          lens_id?: string
          lens_name?: string
          line_check?: Json | null
          rated_at?: string | null
          rating_error?: string | null
          rating_status?: string
          ratings?: Json | null
          rationale?: string | null
          revise_count?: number
          revise_notes?: string | null
          run_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stimulus_directions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "stimulus_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      stimulus_orchestrations: {
        Row: {
          amendment_log: Json
          cd_output: string | null
          cd_revision_count: number
          cd_status: string
          created_at: string
          created_by: string | null
          error: string | null
          gate_two_confirmed: boolean
          gate_two_confirmed_at: string | null
          gate_two_notes: string | null
          gate_two_snapshot: Json | null
          id: string
          phase_note: string | null
          registry_version: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amendment_log?: Json
          cd_output?: string | null
          cd_revision_count?: number
          cd_status?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          gate_two_confirmed?: boolean
          gate_two_confirmed_at?: string | null
          gate_two_notes?: string | null
          gate_two_snapshot?: Json | null
          id?: string
          phase_note?: string | null
          registry_version?: number
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amendment_log?: Json
          cd_output?: string | null
          cd_revision_count?: number
          cd_status?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          gate_two_confirmed?: boolean
          gate_two_confirmed_at?: string | null
          gate_two_notes?: string | null
          gate_two_snapshot?: Json | null
          id?: string
          phase_note?: string | null
          registry_version?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stimulus_orchestrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brand_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_orchestrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stimulus_prompts: {
        Row: {
          cd_note: string | null
          channel_name: string
          created_at: string
          direction_id: string
          error: string | null
          final_prompt: string | null
          gate_two_approved: boolean
          gate_two_approved_at: string | null
          gate_two_notes: string | null
          gate_two_snapshot: Json | null
          id: string
          initial_prompt: string | null
          lens_name: string
          orchestration_id: string
          propagated: boolean
          rejected_at: string | null
          rejected_reason: string | null
          revision_log: Json
          run_id: string
          signatures_extracted: boolean
          sort_order: number
          status: string
          tool_target: string
          updated_at: string
          wad_notes: string | null
          wad_reasoning: string | null
          wad_revision_count: number
          wad_status: string
          working_prompt: string | null
        }
        Insert: {
          cd_note?: string | null
          channel_name: string
          created_at?: string
          direction_id: string
          error?: string | null
          final_prompt?: string | null
          gate_two_approved?: boolean
          gate_two_approved_at?: string | null
          gate_two_notes?: string | null
          gate_two_snapshot?: Json | null
          id?: string
          initial_prompt?: string | null
          lens_name?: string
          orchestration_id: string
          propagated?: boolean
          rejected_at?: string | null
          rejected_reason?: string | null
          revision_log?: Json
          run_id: string
          signatures_extracted?: boolean
          sort_order?: number
          status?: string
          tool_target?: string
          updated_at?: string
          wad_notes?: string | null
          wad_reasoning?: string | null
          wad_revision_count?: number
          wad_status?: string
          working_prompt?: string | null
        }
        Update: {
          cd_note?: string | null
          channel_name?: string
          created_at?: string
          direction_id?: string
          error?: string | null
          final_prompt?: string | null
          gate_two_approved?: boolean
          gate_two_approved_at?: string | null
          gate_two_notes?: string | null
          gate_two_snapshot?: Json | null
          id?: string
          initial_prompt?: string | null
          lens_name?: string
          orchestration_id?: string
          propagated?: boolean
          rejected_at?: string | null
          rejected_reason?: string | null
          revision_log?: Json
          run_id?: string
          signatures_extracted?: boolean
          sort_order?: number
          status?: string
          tool_target?: string
          updated_at?: string
          wad_notes?: string | null
          wad_reasoning?: string | null
          wad_revision_count?: number
          wad_status?: string
          working_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stimulus_prompts_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "stimulus_directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_prompts_orchestration_id_fkey"
            columns: ["orchestration_id"]
            isOneToOne: false
            referencedRelation: "stimulus_orchestrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_prompts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "stimulus_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      stimulus_runs: {
        Row: {
          channel_brief: string
          channel_name: string
          created_at: string
          created_by: string | null
          error: string | null
          gate_one_confirmed: boolean
          gate_one_confirmed_at: string | null
          id: string
          locked_at: string | null
          run_mode: string
          session_id: string
          smp: string
          status: string
          tiebreaker_at: string | null
          tiebreaker_fired: boolean
          tiebreaker_output: string | null
          tiebreaker_reason: string | null
          updated_at: string
          winning_direction_id: string | null
          winning_line: string | null
          winning_line_direction_id: string | null
        }
        Insert: {
          channel_brief?: string
          channel_name: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          gate_one_confirmed?: boolean
          gate_one_confirmed_at?: string | null
          id?: string
          locked_at?: string | null
          run_mode?: string
          session_id: string
          smp?: string
          status?: string
          tiebreaker_at?: string | null
          tiebreaker_fired?: boolean
          tiebreaker_output?: string | null
          tiebreaker_reason?: string | null
          updated_at?: string
          winning_direction_id?: string | null
          winning_line?: string | null
          winning_line_direction_id?: string | null
        }
        Update: {
          channel_brief?: string
          channel_name?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          gate_one_confirmed?: boolean
          gate_one_confirmed_at?: string | null
          id?: string
          locked_at?: string | null
          run_mode?: string
          session_id?: string
          smp?: string
          status?: string
          tiebreaker_at?: string | null
          tiebreaker_fired?: boolean
          tiebreaker_output?: string | null
          tiebreaker_reason?: string | null
          updated_at?: string
          winning_direction_id?: string | null
          winning_line?: string | null
          winning_line_direction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stimulus_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brand_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_runs_winning_direction_id_fkey"
            columns: ["winning_direction_id"]
            isOneToOne: false
            referencedRelation: "stimulus_directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_runs_winning_line_direction_id_fkey"
            columns: ["winning_line_direction_id"]
            isOneToOne: false
            referencedRelation: "stimulus_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      stimulus_signatures: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          name: string
          orchestration_id: string
          origin: string
          registry_version: number
          retired_at: string | null
          retired_reason: string | null
          source_channel: string | null
          source_direction_id: string | null
          source_prompt_id: string | null
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          id?: string
          name: string
          orchestration_id: string
          origin?: string
          registry_version?: number
          retired_at?: string | null
          retired_reason?: string | null
          source_channel?: string | null
          source_direction_id?: string | null
          source_prompt_id?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          orchestration_id?: string
          origin?: string
          registry_version?: number
          retired_at?: string | null
          retired_reason?: string | null
          source_channel?: string | null
          source_direction_id?: string | null
          source_prompt_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stimulus_signatures_orchestration_id_fkey"
            columns: ["orchestration_id"]
            isOneToOne: false
            referencedRelation: "stimulus_orchestrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stimulus_signatures_source_prompt_id_fkey"
            columns: ["source_prompt_id"]
            isOneToOne: false
            referencedRelation: "stimulus_prompts"
            referencedColumns: ["id"]
          },
        ]
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
      synthesiser_runs: {
        Row: {
          applied_at: string | null
          brand_name: string
          category: string | null
          claim_count: number
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          brand_name: string
          category?: string | null
          claim_count?: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          brand_name?: string
          category?: string | null
          claim_count?: number
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tier2_harness_runs: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          donor_session_id: string | null
          id: string
          log: Json
          phase: string
          result_detail: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          donor_session_id?: string | null
          id?: string
          log?: Json
          phase?: string
          result_detail?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          donor_session_id?: string | null
          id?: string
          log?: Json
          phase?: string
          result_detail?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_admin: boolean
          plan: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
          plan?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          plan?: string
        }
        Relationships: []
      }
    }
    Views: {
      brand_register_briefings: {
        Row: {
          brand_name: string | null
          category: string | null
          created_at: string | null
          has_diagnosis: boolean | null
          has_relevance: boolean | null
          has_tensions: boolean | null
          has_truths: boolean | null
          id: string | null
          selected_tension_index: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          brand_name?: string | null
          category?: string | null
          created_at?: string | null
          has_diagnosis?: never
          has_relevance?: never
          has_tensions?: never
          has_truths?: never
          id?: string | null
          selected_tension_index?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_name?: string | null
          category?: string | null
          created_at?: string | null
          has_diagnosis?: never
          has_relevance?: never
          has_tensions?: never
          has_truths?: never
          id?: string | null
          selected_tension_index?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      brand_register_sessions: {
        Row: {
          brand_name: string | null
          category: string | null
          created_at: string | null
          current_stage: number | null
          has_stage_16_consulting: boolean | null
          has_stage_17: boolean | null
          has_stage_22: boolean | null
          id: string | null
          interrupted_stage: number | null
          is_preflight_test: boolean | null
          last_heartbeat_at: string | null
          phase_2_status: string | null
          stage_status: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          brand_name?: string | null
          category?: string | null
          created_at?: string | null
          current_stage?: number | null
          has_stage_16_consulting?: never
          has_stage_17?: never
          has_stage_22?: never
          id?: string | null
          interrupted_stage?: number | null
          is_preflight_test?: boolean | null
          last_heartbeat_at?: string | null
          phase_2_status?: string | null
          stage_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_name?: string | null
          category?: string | null
          created_at?: string | null
          current_stage?: number | null
          has_stage_16_consulting?: never
          has_stage_17?: never
          has_stage_22?: never
          id?: string | null
          interrupted_stage?: number | null
          is_preflight_test?: boolean | null
          last_heartbeat_at?: string | null
          phase_2_status?: string | null
          stage_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_session_owner: {
        Args: { _session_id: string; _user_id: string }
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
  public: {
    Enums: {},
  },
} as const
