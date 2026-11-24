CREATE TABLE public.checkpoint_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  checkpoint text NOT NULL CHECK (checkpoint IN ('c')),
  confirmed_by uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  selected_smp text
);
CREATE INDEX checkpoint_confirmations_session_idx ON public.checkpoint_confirmations (session_id, checkpoint, confirmed_at DESC);
GRANT INSERT ON public.checkpoint_confirmations TO authenticated;
GRANT ALL ON public.checkpoint_confirmations TO service_role;
ALTER TABLE public.checkpoint_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Confirmers record their own confirmation" ON public.checkpoint_confirmations
  FOR INSERT TO authenticated WITH CHECK (confirmed_by = auth.uid() AND confirmed_at > now() - interval '1 minute' AND confirmed_at < now() + interval '1 minute');
COMMENT ON TABLE public.checkpoint_confirmations IS 'Append-only: who confirmed Checkpoint C and when. No update or delete access.';