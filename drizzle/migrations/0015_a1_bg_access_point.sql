CREATE TABLE public.bg_access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('hub_tools','second_brain','admin')),
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
COMMENT ON TABLE public.bg_access_keys IS 'Access point keys. SHA-256 hash only; the key itself is shown once at creation and never stored.';
GRANT ALL ON public.bg_access_keys TO service_role;
ALTER TABLE public.bg_access_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bg_access_keys_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Access keys are never deleted; revoke instead.'; END IF;
  IF NEW.id <> OLD.id OR NEW.scope <> OLD.scope OR NEW.key_hash <> OLD.key_hash OR NEW.label <> OLD.label
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Only revoked_at can change on an access key.';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'A revoked key stays revoked.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bg_access_keys_guard BEFORE UPDATE OR DELETE ON public.bg_access_keys
  FOR EACH ROW EXECUTE FUNCTION public.bg_access_keys_guard();

CREATE TABLE public.bg_access_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL,
  scope text,
  key_id uuid,
  client_ref text,
  run_id uuid,
  request text,
  output_id text,
  outcome text NOT NULL CHECK (outcome IN ('success','error')),
  error_code text CHECK (error_code IS NULL OR error_code IN ('invalid_request','unauthorised','forbidden_scope','not_found','unavailable')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.bg_access_log IS 'Append-only access point request log. Never keys, secrets or content.';
CREATE INDEX bg_access_log_time_idx ON public.bg_access_log (created_at DESC);
GRANT SELECT, INSERT ON public.bg_access_log TO service_role;
ALTER TABLE public.bg_access_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bg_access_log_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'The access log is append-only.'; END $$;
CREATE TRIGGER bg_access_log_append_only BEFORE UPDATE OR DELETE ON public.bg_access_log
  FOR EACH ROW EXECUTE FUNCTION public.bg_access_log_append_only();
CREATE TRIGGER bg_access_log_no_truncate BEFORE TRUNCATE ON public.bg_access_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.bg_access_log_append_only();
REVOKE ALL ON FUNCTION public.bg_access_keys_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bg_access_log_append_only() FROM PUBLIC, anon, authenticated;