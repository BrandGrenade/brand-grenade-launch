REVOKE ALL ON public.run_output_versions FROM anon, authenticated;
GRANT SELECT ON public.run_output_versions TO authenticated;
REVOKE ALL ON public.synthesiser_claims FROM anon, authenticated;
GRANT SELECT, INSERT ON public.synthesiser_claims TO authenticated;