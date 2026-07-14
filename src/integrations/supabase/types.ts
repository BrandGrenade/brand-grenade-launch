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
            referencedRelation: "sessions"
            referencedColumns: ["id"]
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
          interrupted_stage: number | null
          is_preflight_test: boolean
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
          phase_2_current_stage: string
          phase_2_status: string
          retry_status: string | null
          selected_format: string | null
          selected_smp: string | null
          selected_smp_field_name: string | null
          selection_rationale: Json | null
          selection_rationale_1: string | null
          selection_rationale_2: string | null
          selection_rationale_3: string | null
          selection_rationale_4: string | null
          selection_rationale_5: string | null
          selection_rationale_6: string | null
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
          stage_21_error: string | null
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
          interrupted_stage?: number | null
          is_preflight_test?: boolean
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
          phase_2_current_stage?: string
          phase_2_status?: string
          retry_status?: string | null
          selected_format?: string | null
          selected_smp?: string | null
          selected_smp_field_name?: string | null
          selection_rationale?: Json | null
          selection_rationale_1?: string | null
          selection_rationale_2?: string | null
          selection_rationale_3?: string | null
          selection_rationale_4?: string | null
          selection_rationale_5?: string | null
          selection_rationale_6?: string | null
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
          stage_21_error?: string | null
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
          stage_status?: string | null
          status?: string
          strategic_mode: string
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
          interrupted_stage?: number | null
          is_preflight_test?: boolean
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
          phase_2_current_stage?: string
          phase_2_status?: string
          retry_status?: string | null
          selected_format?: string | null
          selected_smp?: string | null
          selected_smp_field_name?: string | null
          selection_rationale?: Json | null
          selection_rationale_1?: string | null
          selection_rationale_2?: string | null
          selection_rationale_3?: string | null
          selection_rationale_4?: string | null
          selection_rationale_5?: string | null
          selection_rationale_6?: string | null
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
          stage_21_error?: string | null
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
