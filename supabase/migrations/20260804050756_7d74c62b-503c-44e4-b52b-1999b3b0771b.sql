CREATE TABLE public.stimulus_orchestrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_by uuid,
  status text NOT NULL DEFAULT 'pending',
  phase_note text,
  registry_version integer NOT NULL DEFAULT 1,
  cd_output text,
  cd_status text NOT NULL DEFAULT 'pending',
  cd_revision_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_orchestrations TO authenticated;
GRANT ALL ON public.stimulus_orchestrations TO service_role;
ALTER TABLE public.stimulus_orchestrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session members manage orchestrations" ON public.stimulus_orchestrations
  FOR ALL TO authenticated
  USING (public.can_access_session(session_id, auth.uid()))
  WITH CHECK (public.can_access_session(session_id, auth.uid()));
CREATE TRIGGER stimulus_orchestrations_touch BEFORE UPDATE ON public.stimulus_orchestrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_stimulus_orchestrations_session ON public.stimulus_orchestrations(session_id);

CREATE TABLE public.stimulus_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id uuid NOT NULL REFERENCES public.stimulus_orchestrations(id) ON DELETE CASCADE,
  direction_id uuid NOT NULL REFERENCES public.stimulus_directions(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.stimulus_runs(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  lens_name text NOT NULL DEFAULT '',
  tool_target text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  initial_prompt text,
  working_prompt text,
  final_prompt text,
  wad_status text NOT NULL DEFAULT 'pending',
  wad_notes text,
  wad_reasoning text,
  wad_revision_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  rejected_reason text,
  rejected_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_prompts TO authenticated;
GRANT ALL ON public.stimulus_prompts TO service_role;
ALTER TABLE public.stimulus_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session members manage stimulus prompts" ON public.stimulus_prompts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stimulus_orchestrations o WHERE o.id = orchestration_id AND public.can_access_session(o.session_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stimulus_orchestrations o WHERE o.id = orchestration_id AND public.can_access_session(o.session_id, auth.uid())));
CREATE TRIGGER stimulus_prompts_touch BEFORE UPDATE ON public.stimulus_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_stimulus_prompts_unique ON public.stimulus_prompts(orchestration_id, direction_id);

CREATE TABLE public.stimulus_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id uuid NOT NULL REFERENCES public.stimulus_orchestrations(id) ON DELETE CASCADE,
  source_prompt_id uuid REFERENCES public.stimulus_prompts(id) ON DELETE SET NULL,
  source_direction_id uuid,
  source_channel text,
  category text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'extracted',
  status text NOT NULL DEFAULT 'active',
  retired_reason text,
  retired_at timestamptz,
  registry_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_signatures TO authenticated;
GRANT ALL ON public.stimulus_signatures TO service_role;
ALTER TABLE public.stimulus_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session members manage signatures" ON public.stimulus_signatures
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stimulus_orchestrations o WHERE o.id = orchestration_id AND public.can_access_session(o.session_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stimulus_orchestrations o WHERE o.id = orchestration_id AND public.can_access_session(o.session_id, auth.uid())));
CREATE INDEX idx_stimulus_signatures_orch ON public.stimulus_signatures(orchestration_id);

CREATE TABLE public.stimulus_cross_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id uuid NOT NULL REFERENCES public.stimulus_orchestrations(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.stimulus_prompts(id) ON DELETE CASCADE,
  signature_id uuid REFERENCES public.stimulus_signatures(id) ON DELETE SET NULL,
  source_direction_id uuid,
  suggestion text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'suggested',
  decision_reason text,
  decided_at timestamptz,
  registry_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_cross_refs TO authenticated;
GRANT ALL ON public.stimulus_cross_refs TO service_role;
ALTER TABLE public.stimulus_cross_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session members manage cross refs" ON public.stimulus_cross_refs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stimulus_orchestrations o WHERE o.id = orchestration_id AND public.can_access_session(o.session_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stimulus_orchestrations o WHERE o.id = orchestration_id AND public.can_access_session(o.session_id, auth.uid())));
CREATE INDEX idx_stimulus_cross_refs_orch ON public.stimulus_cross_refs(orchestration_id);

CREATE TABLE public.brand_asset_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_name text NOT NULL,
  brand_key text NOT NULL,
  colours text,
  logo_references text,
  typography text,
  packaging_rules text,
  legal_lines text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_asset_rules TO authenticated;
GRANT ALL ON public.brand_asset_rules TO service_role;
ALTER TABLE public.brand_asset_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own brand asset rules" ON public.brand_asset_rules
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER brand_asset_rules_touch BEFORE UPDATE ON public.brand_asset_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_brand_asset_rules_unique ON public.brand_asset_rules(user_id, brand_key);