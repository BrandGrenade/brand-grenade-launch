CREATE OR REPLACE FUNCTION public.repository_visitors_password_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.plaintext_password := NULL;
  IF NEW.password_hash NOT LIKE '$2%' THEN
    RAISE EXCEPTION 'repository visitor passwords must be bcrypt hashes';
  END IF;
  RETURN NEW;
END $$;