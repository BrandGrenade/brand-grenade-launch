CREATE TABLE public.stimulus_direction_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction_id uuid NOT NULL REFERENCES public.stimulus_directions(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.stimulus_runs(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL,
  origin text NOT NULL DEFAULT 'initial',
  direction text,
  campaign_line text,
  rationale text,
  line_check jsonb,
  revise_notes text,
  ratings jsonb,
  rating_status text NOT NULL DEFAULT 'unrated',
  rated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (direction_id, attempt_no)
);

CREATE INDEX stimulus_direction_attempts_direction_idx
  ON public.stimulus_direction_attempts (direction_id, attempt_no);

ALTER TABLE public.stimulus_directions
  ADD COLUMN active_attempt_id uuid REFERENCES public.stimulus_direction_attempts(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_direction_attempts TO authenticated;
GRANT ALL ON public.stimulus_direction_attempts TO service_role;

ALTER TABLE public.stimulus_direction_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members manage stimulus attempts"
  ON public.stimulus_direction_attempts
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stimulus_runs r
    WHERE r.id = stimulus_direction_attempts.run_id
      AND public.can_access_session(r.session_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stimulus_runs r
    WHERE r.id = stimulus_direction_attempts.run_id
      AND public.can_access_session(r.session_id, auth.uid())
  ));

-- Backfill: every existing direction becomes Attempt 1 and is set active.
WITH inserted AS (
  INSERT INTO public.stimulus_direction_attempts
    (direction_id, run_id, attempt_no, origin, direction, campaign_line, rationale,
     line_check, revise_notes, ratings, rating_status, rated_at, created_at)
  SELECT d.id, d.run_id, 1,
         CASE WHEN COALESCE(d.revise_count, 0) > 0 THEN 'revise' ELSE 'initial' END,
         d.direction, d.campaign_line, d.rationale, d.line_check, d.revise_notes,
         d.ratings, COALESCE(d.rating_status, 'unrated'), d.rated_at, COALESCE(d.created_at, now())
  FROM public.stimulus_directions d
  WHERE d.direction IS NOT NULL
  RETURNING id, direction_id
)
UPDATE public.stimulus_directions d
SET active_attempt_id = i.id
FROM inserted i
WHERE d.id = i.direction_id;