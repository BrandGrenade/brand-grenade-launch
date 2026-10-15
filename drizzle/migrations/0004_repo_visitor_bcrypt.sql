ALTER TABLE public.repository_visitors ADD COLUMN IF NOT EXISTS password_hash_bcrypt text;

CREATE OR REPLACE FUNCTION public.repository_visitors_password_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Never persist a readable password, whatever the caller sends.
  NEW.plaintext_password := NULL;
  -- If a writer sets a legacy (non-bcrypt) hash, drop any stale bcrypt hash so
  -- the old password stops working.
  IF TG_OP = 'UPDATE' AND NEW.password_hash IS DISTINCT FROM OLD.password_hash
     AND NEW.password_hash NOT LIKE '$2%'
     AND NEW.password_hash_bcrypt IS NOT DISTINCT FROM OLD.password_hash_bcrypt THEN
    NEW.password_hash_bcrypt := NULL;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON public.repository_visitors FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.repository_visitors TO service_role;

COMMENT ON COLUMN public.repository_visitors.plaintext_password IS 'DEPRECATED: readable passwords are no longer stored; always NULL (enforced by trigger).';
COMMENT ON COLUMN public.repository_visitors.password_hash_bcrypt IS 'bcrypt hash of the visitor password; preferred over password_hash.';