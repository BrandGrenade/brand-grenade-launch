ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS brief_type text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS deal_transaction_type text,
  ADD COLUMN IF NOT EXISTS deal_target_brands text[],
  ADD COLUMN IF NOT EXISTS deal_decision_questions text[],
  ADD COLUMN IF NOT EXISTS deal_competitors text[],
  ADD COLUMN IF NOT EXISTS deal_decision_date date,
  ADD COLUMN IF NOT EXISTS deal_depth text;

ALTER TABLE public.sessions ADD CONSTRAINT sessions_brief_type_check CHECK (brief_type IN ('campaign','deal'));
ALTER TABLE public.sessions ADD CONSTRAINT sessions_deal_fields_check CHECK (
  (brief_type = 'campaign' AND deal_transaction_type IS NULL AND deal_target_brands IS NULL AND deal_decision_questions IS NULL
     AND deal_competitors IS NULL AND deal_decision_date IS NULL AND deal_depth IS NULL)
  OR (brief_type = 'deal'
     AND deal_transaction_type IN ('buy-side','sell-side','exit','carve-out','post-merger')
     AND deal_depth IN ('outside-in','data-room')
     AND coalesce(array_length(deal_target_brands,1),0) > 0
     AND coalesce(array_length(deal_decision_questions,1),0) > 0
     AND coalesce(array_length(deal_competitors,1),0) > 0
     AND deal_decision_date IS NOT NULL
     AND coalesce(btrim(current_proposition),'') <> ''
     AND current_proposition_source IS NOT NULL AND current_proposition_date IS NOT NULL));

COMMENT ON COLUMN public.sessions.brief_type IS 'campaign | deal. Chosen by hand on the brief form; immutable once Stage 1 has output.';

CREATE OR REPLACE FUNCTION public.bg_deal_fields_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.stage_1_output IS NOT NULL AND (
       NEW.brief_type IS DISTINCT FROM OLD.brief_type
    OR NEW.deal_transaction_type IS DISTINCT FROM OLD.deal_transaction_type
    OR NEW.deal_target_brands IS DISTINCT FROM OLD.deal_target_brands
    OR NEW.deal_decision_questions IS DISTINCT FROM OLD.deal_decision_questions
    OR NEW.deal_competitors IS DISTINCT FROM OLD.deal_competitors
    OR NEW.deal_decision_date IS DISTINCT FROM OLD.deal_decision_date
    OR NEW.deal_depth IS DISTINCT FROM OLD.deal_depth) THEN
    RAISE EXCEPTION 'Brief type and deal fields cannot change once Stage 1 has run.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bg_deal_fields_immutable_trg BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.bg_deal_fields_immutable();