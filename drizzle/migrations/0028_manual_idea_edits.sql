CREATE OR REPLACE FUNCTION public.bg_manual_edit_idea(_direction_id uuid, _expected_attempt_id uuid, _description text, _field1 text, _field2 text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE d public.stimulus_directions%ROWTYPE; sid uuid; aid uuid; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to edit an idea'; END IF;
  SELECT * INTO d FROM public.stimulus_directions WHERE id = _direction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Idea not found or access denied'; END IF;
  SELECT session_id INTO sid FROM public.stimulus_runs WHERE id = d.run_id;
  IF sid IS NULL OR NOT public.can_access_session(sid, auth.uid()) THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF d.active_attempt_id IS DISTINCT FROM _expected_attempt_id THEN
    RAISE EXCEPTION 'This idea has a newer version. Close the editor, reload and try again.';
  END IF;
  IF _description IS NULL OR btrim(_description) = '' OR _field1 IS NULL OR _field2 IS NULL THEN
    RAISE EXCEPTION 'Description is required and both line fields must be supplied';
  END IF;
  SELECT coalesce(max(attempt_no), 0) INTO n FROM public.stimulus_direction_attempts WHERE direction_id = d.id;
  IF n = 0 AND coalesce(d.direction, '') <> '' THEN
    INSERT INTO public.stimulus_direction_attempts (direction_id, run_id, attempt_no, origin, direction, campaign_line, expression_under_master, master_line_at_generation, rationale, line_check, revise_notes, ratings, rating_status, rated_at)
    VALUES (d.id, d.run_id, 1, 'initial', d.direction, d.campaign_line, d.expression_under_master, d.master_line_at_generation, d.rationale, d.line_check, d.revise_notes, d.ratings, d.rating_status, d.rated_at);
    n := 1;
  END IF;
  INSERT INTO public.stimulus_direction_attempts (direction_id, run_id, attempt_no, origin, direction, campaign_line, expression_under_master, master_line_at_generation, rationale, line_check, revise_notes, ratings, rating_status, rated_at)
  VALUES (d.id, d.run_id, n + 1, 'manual_edit', _description, _field1, _field2, d.master_line_at_generation, d.rationale, d.line_check, 'Manual edit; no regeneration.', d.ratings, d.rating_status, d.rated_at)
  RETURNING id INTO aid;
  UPDATE public.stimulus_directions SET direction = _description, campaign_line = _field1, expression_under_master = _field2, active_attempt_id = aid WHERE id = d.id;
  RETURN aid;
END;
$$;
REVOKE ALL ON FUNCTION public.bg_manual_edit_idea(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bg_manual_edit_idea(uuid, uuid, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.bg_manual_edit_idea(uuid, uuid, text, text, text) IS 'Exact manual idea edits: authorized via existing RLS/session access, append-only attempt history and atomic active-version conflict check; no generation or judgement changes.';