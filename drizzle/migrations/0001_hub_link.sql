-- lovable-cron-fallback-reviewed: retry tick armed only on enqueue and unscheduled once outbox drains; 1-minute cadence required by the 1-minute first retry
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS hub_client text, ADD COLUMN IF NOT EXISTS hub_job text, ADD COLUMN IF NOT EXISTS hub_ctx text;
ALTER TABLE public.intelligence_sessions ADD COLUMN IF NOT EXISTS hub_client text, ADD COLUMN IF NOT EXISTS hub_job text, ADD COLUMN IF NOT EXISTS hub_ctx text;
ALTER TABLE public.briefing_room_workspaces ADD COLUMN IF NOT EXISTS hub_client text, ADD COLUMN IF NOT EXISTS hub_job text, ADD COLUMN IF NOT EXISTS hub_ctx text;
ALTER TABLE public.synthesiser_runs ADD COLUMN IF NOT EXISTS hub_client text, ADD COLUMN IF NOT EXISTS hub_job text, ADD COLUMN IF NOT EXISTS hub_ctx text;
ALTER TABLE public.stimulus_runs ADD COLUMN IF NOT EXISTS hub_client text, ADD COLUMN IF NOT EXISTS hub_job text, ADD COLUMN IF NOT EXISTS hub_ctx text;

CREATE TABLE public.hub_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_client text NOT NULL,
  hub_job text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT ALL ON public.hub_outbox TO service_role;
ALTER TABLE public.hub_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX hub_outbox_due ON public.hub_outbox (status, next_attempt_at);

CREATE OR REPLACE FUNCTION public.hub_wake() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hub-outbox-retry') THEN
      PERFORM cron.schedule('hub-outbox-retry', '* * * * *', $c$ SELECT public.hub_wake(); $c$);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'hub_wake schedule: %', SQLERRM; END;
  BEGIN
    PERFORM net.http_post(
      url := 'https://project--00f8f168-9af0-4e35-a994-3f3194d41422.lovable.app/api/public/hub-tick',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb, timeout_milliseconds := 30000);
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.hub_disarm_if_drained() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
  IF NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE status = 'pending')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hub-outbox-retry') THEN
    PERFORM cron.unschedule('hub-outbox-retry');
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'hub_disarm: %', SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hub_disarm_if_drained() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_wake() TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_disarm_if_drained() TO service_role;

CREATE OR REPLACE FUNCTION public.hub_actor(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT left(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email), 120)
  FROM auth.users u WHERE u.id = _uid
$$;

CREATE OR REPLACE FUNCTION public.hub_enqueue(_client text, _job text, _room text, _event text, _title text, _actor text, _fp text, _doc jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _client IS NULL OR btrim(_client) = '' THEN RETURN; END IF;
  INSERT INTO public.hub_outbox (hub_client, hub_job, payload)
  VALUES (_client, _job, jsonb_strip_nulls(jsonb_build_object(
    'client_ref', _client, 'job_ref', _job, 'room', _room, 'event_type', _event,
    'title', left(_title, 200), 'actor', _actor, 'input_fingerprint', _fp,
    'occurred_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'document', _doc)));
  PERFORM public.hub_wake();
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'hub_enqueue failed (run unaffected): %', SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_enqueue(text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hub_actor(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_fp(_j jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(_j::text, 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.hub_doc(_name text, _path text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('name', _name, 'mime', 'text/html', 'url', 'https://brandgrenade.app' || _path)
$$;

CREATE OR REPLACE FUNCTION public.hub_sessions_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := NEW.hub_client; j text := NEW.hub_job; a text; fp text; t text := NEW.brand_name; k text;
BEGIN
  IF c IS NULL THEN RETURN NEW; END IF;
  a := public.hub_actor(NEW.user_id);
  fp := public.hub_fp(jsonb_build_object('brief', NEW.brief_text, 'research_ids', '[]'::jsonb));
  IF TG_OP = 'INSERT' OR OLD.hub_client IS NULL THEN
    PERFORM public.hub_enqueue(c,j,'room-03','run_started','Strategy Pipeline run started — '||t,a,fp,NULL);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
      PERFORM public.hub_enqueue(c,j,'room-03','run_completed','Strategy Pipeline run completed — '||t,a,fp,NULL);
    END IF;
    FOREACH k IN ARRAY ARRAY['a','b','c','d','e','f'] LOOP
      IF coalesce((to_jsonb(NEW)->>('checkpoint_'||k||'_confirmed'))::boolean,false) AND NOT coalesce((to_jsonb(OLD)->>('checkpoint_'||k||'_confirmed'))::boolean,false) THEN
        PERFORM public.hub_enqueue(c,j,'room-03','review_decision','Checkpoint '||upper(k)||' approved — '||t,a,NULL,NULL);
      END IF;
    END LOOP;
    IF NEW.strategy_signoff_confirmed AND NOT OLD.strategy_signoff_confirmed THEN
      PERFORM public.hub_enqueue(c,j,'room-03','signed_off','Strategy signed off — '||t,a,NULL,NULL);
    END IF;
    IF NEW.strategy_signoff_stop AND NOT OLD.strategy_signoff_stop THEN
      PERFORM public.hub_enqueue(c,j,'room-03','review_decision','Strategy sent back at sign-off — '||t,a,NULL,NULL);
    END IF;
    FOREACH k IN ARRAY ARRAY['consulting','agency','workshop'] LOOP
      IF to_jsonb(NEW)->>('doc_'||k||'_status') = 'ready' AND (to_jsonb(OLD)->>('doc_'||k||'_status')) IS DISTINCT FROM 'ready' THEN
        PERFORM public.hub_enqueue(c,j,'room-03','document_created',initcap(k)||' document — '||t,a,fp,
          public.hub_doc(initcap(k)||' document — '||t, '/complete?session='||NEW.id));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hub_sessions AFTER INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.hub_sessions_trg();

CREATE OR REPLACE FUNCTION public.hub_intel_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := NEW.hub_client; j text := NEW.hub_job; a text; t text := NEW.brand_name; fp text;
BEGIN
  IF c IS NULL THEN RETURN NEW; END IF;
  a := public.hub_actor(NEW.user_id);
  fp := public.hub_fp(jsonb_build_object('brief', coalesce(NEW.territory_input,''), 'research_ids', '[]'::jsonb));
  IF TG_OP = 'INSERT' OR OLD.hub_client IS NULL THEN
    IF coalesce(NEW.input_primary_consumer,NEW.input_brand_health,NEW.input_competitive_audit,NEW.input_cultural_trends,NEW.input_audience_segmentation,NEW.input_bg_intel_pack) IS NOT NULL THEN
      PERFORM public.hub_enqueue(c,j,'room-01','research_added','Research added to Intelligence Lab — '||t,a,NULL,NULL);
    END IF;
  END IF;
  IF NEW.status IN ('queued','running') AND (TG_OP='INSERT' OR OLD.status NOT IN ('queued','running')) THEN
    PERFORM public.hub_enqueue(c,j,'room-01','run_started','Intelligence Lab run started — '||t,a,fp,NULL);
  END IF;
  IF TG_OP='UPDATE' AND NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    PERFORM public.hub_enqueue(c,j,'room-01','run_completed','Intelligence Lab run completed — '||t,a,fp,NULL);
    PERFORM public.hub_enqueue(c,j,'room-01','document_created','Strategic Territory Intelligence Report — '||t,a,fp,
      public.hub_doc('Strategic Territory Intelligence Report — '||t, '/intelligence/'||NEW.id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hub_intel AFTER INSERT OR UPDATE ON public.intelligence_sessions FOR EACH ROW EXECUTE FUNCTION public.hub_intel_trg();

CREATE OR REPLACE FUNCTION public.hub_briefing_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := NEW.hub_client; j text := NEW.hub_job; a text; t text := NEW.brand_name; fp text;
  steps text[] := ARRAY['diagnosis','truths','relevance','tensions']; names text[] := ARRAY['Brief diagnosis','Evidence truths','Relevance filter','Tensions']; i int;
BEGIN
  IF c IS NULL THEN RETURN NEW; END IF;
  a := public.hub_actor(NEW.user_id);
  fp := public.hub_fp(jsonb_build_object('brief', NEW.raw_brief, 'research_ids', '[]'::jsonb));
  IF TG_OP = 'INSERT' OR OLD.hub_client IS NULL THEN
    PERFORM public.hub_enqueue(c,j,'room-02','run_started','Briefing Room started — '||t,a,fp,NULL);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    FOR i IN 1..4 LOOP
      IF coalesce(jsonb_typeof(to_jsonb(NEW)->steps[i]),'null') <> 'null'
         AND coalesce(jsonb_typeof(to_jsonb(OLD)->steps[i]),'null') = 'null' THEN
        PERFORM public.hub_enqueue(c,j,'room-02','run_completed',names[i]||' completed — '||t,a,fp,NULL);
      END IF;
    END LOOP;
    IF OLD.truths IS NOT NULL AND NEW.truths IS NOT NULL AND NEW.truths::text <> OLD.truths::text
       AND NEW.truths::text LIKE '%"human_%' THEN
      PERFORM public.hub_enqueue(c,j,'room-02','research_added','Evidence corrected or added — '||t,a,NULL,NULL);
    END IF;
    IF NEW.selected_frame IS NOT NULL AND OLD.selected_frame IS DISTINCT FROM NEW.selected_frame THEN
      PERFORM public.hub_enqueue(c,j,'room-02','review_decision','Brief frame selected — '||t,a,NULL,NULL);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hub_briefing AFTER INSERT OR UPDATE ON public.briefing_room_workspaces FOR EACH ROW EXECUTE FUNCTION public.hub_briefing_trg();

CREATE OR REPLACE FUNCTION public.hub_synth_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.hub_client IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'applied' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'applied') THEN
    PERFORM public.hub_enqueue(NEW.hub_client,NEW.hub_job,'room-00','research_added',
      'Research synthesised — '||NEW.claim_count||' claims — '||NEW.brand_name, public.hub_actor(NEW.user_id), NULL, NULL);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hub_synth AFTER INSERT OR UPDATE ON public.synthesiser_runs FOR EACH ROW EXECUTE FUNCTION public.hub_synth_trg();

CREATE OR REPLACE FUNCTION public.hub_stim_inherit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.hub_client IS NULL THEN
    SELECT s.hub_client, s.hub_job, s.hub_ctx INTO NEW.hub_client, NEW.hub_job, NEW.hub_ctx FROM public.sessions s WHERE s.id = NEW.session_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hub_stim_inherit BEFORE INSERT ON public.stimulus_runs FOR EACH ROW EXECUTE FUNCTION public.hub_stim_inherit();

CREATE OR REPLACE FUNCTION public.hub_stim_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := NEW.hub_client; j text := NEW.hub_job; a text; fp text; t text;
BEGIN
  IF c IS NULL THEN RETURN NEW; END IF;
  a := public.hub_actor(NEW.created_by);
  fp := public.hub_fp(jsonb_build_object('brief', NEW.channel_brief, 'research_ids', '[]'::jsonb));
  t := 'Creative Engine '||replace(NEW.run_mode,'_',' ')||' run';
  IF TG_OP='INSERT' THEN PERFORM public.hub_enqueue(c,j,'room-04','run_started',t||' started',a,fp,NULL); END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.status='complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
      PERFORM public.hub_enqueue(c,j,'room-04','run_completed',t||' completed',a,fp,NULL);
    END IF;
    IF NEW.locked_at IS NOT NULL AND OLD.locked_at IS NULL THEN
      PERFORM public.hub_enqueue(c,j,'room-04','signed_off','Big idea locked'||coalesce(' — '||NEW.winning_line,''),a,fp,NULL);
    END IF;
    IF NEW.gate_one_confirmed AND NOT OLD.gate_one_confirmed THEN
      PERFORM public.hub_enqueue(c,j,'room-04','review_decision','Creative gate one approved',a,NULL,NULL);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hub_stim AFTER INSERT OR UPDATE ON public.stimulus_runs FOR EACH ROW EXECUTE FUNCTION public.hub_stim_trg();
