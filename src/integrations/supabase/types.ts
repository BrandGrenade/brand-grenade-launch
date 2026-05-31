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
      sessions: {
        Row: {
          brand_audience_relationship: string | null
          brand_constraints: string | null
          brand_intelligence: Json | null
          brand_name: string
          brand_organisational_context: string | null
          brand_positioning: string | null
          brand_product_truth: string | null
          brand_tone_of_voice: string | null
          brief_text: string
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
          phase_2_current_stage: number
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
          stage_16_workshop_output: string | null
          stage_1b_output: string | null
          stage_1b_required: boolean
          stage_2_error: string | null
          stage_2_output: string | null
          stage_3_error: string | null
          stage_3_output: string | null
          stage_4_error: string | null
          stage_4_output: string | null
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
          stage_9_output: string | null
          stage_status: string | null
          status: string
          strategic_mode: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          brand_audience_relationship?: string | null
          brand_constraints?: string | null
          brand_intelligence?: Json | null
          brand_name: string
          brand_organisational_context?: string | null
          brand_positioning?: string | null
          brand_product_truth?: string | null
          brand_tone_of_voice?: string | null
          brief_text: string
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
          phase_2_current_stage?: number
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
          stage_16_workshop_output?: string | null
          stage_1b_output?: string | null
          stage_1b_required?: boolean
          stage_2_error?: string | null
          stage_2_output?: string | null
          stage_3_error?: string | null
          stage_3_output?: string | null
          stage_4_error?: string | null
          stage_4_output?: string | null
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
          stage_9_output?: string | null
          stage_status?: string | null
          status?: string
          strategic_mode: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          brand_audience_relationship?: string | null
          brand_constraints?: string | null
          brand_intelligence?: Json | null
          brand_name?: string
          brand_organisational_context?: string | null
          brand_positioning?: string | null
          brand_product_truth?: string | null
          brand_tone_of_voice?: string | null
          brief_text?: string
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
          phase_2_current_stage?: number
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
          stage_16_workshop_output?: string | null
          stage_1b_output?: string | null
          stage_1b_required?: boolean
          stage_2_error?: string | null
          stage_2_output?: string | null
          stage_3_error?: string | null
          stage_3_output?: string | null
          stage_4_error?: string | null
          stage_4_output?: string | null
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
          stage_9_output?: string | null
          stage_status?: string | null
          status?: string
          strategic_mode?: string
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
