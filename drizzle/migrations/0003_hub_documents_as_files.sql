ALTER TABLE public.hub_outbox ADD COLUMN IF NOT EXISTS doc_bytes integer;
ALTER TABLE public.hub_outbox ADD COLUMN IF NOT EXISTS doc_delivery text;

-- Documents are queued as an internal reference; the sender generates the
-- actual file at send time. Never a page link.
CREATE OR REPLACE FUNCTION public.hub_doc(_name text, _path text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('name', _name, 'ref', _path)
$$;

CREATE OR REPLACE FUNCTION public.hub_sessions_trg()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
          public.hub_doc(initcap(k)||' document — '||t, 'session:'||NEW.id||':'||k));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.hub_intel_trg()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      public.hub_doc('Strategic Territory Intelligence Report — '||t, 'intel:'||NEW.id));
  END IF;
  RETURN NEW;
END $function$;

-- Old link-style document references still waiting in the outbox become file references.
UPDATE public.hub_outbox SET payload = jsonb_set(payload, '{document}',
  jsonb_build_object('name', payload->'document'->>'name', 'ref',
    CASE WHEN payload->'document'->>'url' LIKE '%/intelligence/%'
      THEN 'intel:'||split_part(payload->'document'->>'url','/intelligence/',2)
      ELSE 'drop' END))
WHERE status <> 'sent' AND payload->'document' ? 'url';