CREATE TABLE IF NOT EXISTS public.demo_request_rate (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_request_rate TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.demo_request_rate_id_seq TO service_role;
ALTER TABLE public.demo_request_rate ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS demo_request_rate_ip_idx ON public.demo_request_rate(ip_hash, created_at);

CREATE OR REPLACE FUNCTION public.demo_requests_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ip text; h text; n int;
BEGIN
  NEW.name := btrim(coalesce(NEW.name,'')); NEW.email := lower(btrim(coalesce(NEW.email,'')));
  NEW.company := btrim(coalesce(NEW.company,'')); NEW.message := nullif(btrim(coalesce(NEW.message,'')),'');
  IF NEW.name = '' OR length(NEW.name) > 120 THEN RAISE EXCEPTION 'Invalid name' USING ERRCODE='22023'; END IF;
  IF NEW.company = '' OR length(NEW.company) > 160 THEN RAISE EXCEPTION 'Invalid company' USING ERRCODE='22023'; END IF;
  IF length(NEW.email) > 255 OR NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023'; END IF;
  IF NEW.message IS NOT NULL AND length(NEW.message) > 2000 THEN RAISE EXCEPTION 'Message too long' USING ERRCODE='22023'; END IF;
  IF current_user IN ('anon','authenticated') THEN
    NEW.email_sent := false; NEW.email_error := NULL; NEW.created_at := now(); NEW.updated_at := now();
    ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for','unknown'), ',', 1);
    h := encode(sha256(convert_to(btrim(ip),'UTF8')),'hex');
    SELECT count(*) INTO n FROM public.demo_request_rate WHERE ip_hash = h AND created_at > now() - interval '1 hour';
    IF n >= 5 THEN RAISE EXCEPTION 'Too many requests' USING ERRCODE='P0001'; END IF;
    INSERT INTO public.demo_request_rate(ip_hash) VALUES (h);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS demo_requests_validate ON public.demo_requests;
CREATE TRIGGER demo_requests_validate BEFORE INSERT ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.demo_requests_validate();

REVOKE INSERT ON public.demo_requests FROM anon, authenticated;
GRANT INSERT (name, email, company, message) ON public.demo_requests TO anon, authenticated;
DROP POLICY IF EXISTS "Anyone can submit a demo request" ON public.demo_requests;
CREATE POLICY "Anyone can submit a demo request" ON public.demo_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 120 AND length(btrim(company)) BETWEEN 1 AND 160
    AND length(email) <= 255 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (message IS NULL OR length(message) <= 2000)
    AND email_sent = false AND email_error IS NULL);

ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;