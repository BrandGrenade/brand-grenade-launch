-- Intelligence Engine — Step 1: intelligence_sessions table
CREATE TABLE public.intelligence_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Brand / territory inputs
  brand_name TEXT NOT NULL,
  category TEXT,
  territory_input TEXT,
  additional_context TEXT,

  -- Run lifecycle
  status TEXT NOT NULL DEFAULT 'draft',
  current_layer INTEGER NOT NULL DEFAULT 0,
  stage_status TEXT,

  -- 10-layer analytical outputs
  layer_1_output TEXT,
  layer_2_output TEXT,
  layer_3_output TEXT,
  layer_4_output TEXT,
  layer_5_output TEXT,
  layer_6_output TEXT,
  layer_7_output TEXT,
  layer_8_output TEXT,
  layer_9_output TEXT,
  layer_10_output TEXT,

  -- Final deliverable (Document 00A)
  final_report TEXT,
  report_metadata JSONB DEFAULT '{}'::jsonb,

  -- Handoff to Briefing Room
  handoff_payload JSONB,
  handoff_written_at TIMESTAMPTZ,

  -- Error / retry state
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT intelligence_sessions_status_check
    CHECK (status IN ('draft','running','complete','interrupted','failed')),
  CONSTRAINT intelligence_sessions_layer_check
    CHECK (current_layer >= 0 AND current_layer <= 10)
);

-- Indexes
CREATE INDEX intelligence_sessions_user_id_idx
  ON public.intelligence_sessions (user_id);
CREATE INDEX intelligence_sessions_brand_name_idx
  ON public.intelligence_sessions (lower(brand_name));
CREATE INDEX intelligence_sessions_status_idx
  ON public.intelligence_sessions (status);
CREATE INDEX intelligence_sessions_updated_at_idx
  ON public.intelligence_sessions (updated_at DESC);

-- Grants (Data API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_sessions TO authenticated;
GRANT ALL ON public.intelligence_sessions TO service_role;

-- RLS
ALTER TABLE public.intelligence_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own intelligence sessions"
  ON public.intelligence_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own intelligence sessions"
  ON public.intelligence_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intelligence sessions"
  ON public.intelligence_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intelligence sessions"
  ON public.intelligence_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger (reuses existing helper)
CREATE TRIGGER update_intelligence_sessions_updated_at
  BEFORE UPDATE ON public.intelligence_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
