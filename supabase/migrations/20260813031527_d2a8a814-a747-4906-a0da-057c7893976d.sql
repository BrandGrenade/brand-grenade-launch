UPDATE public.sessions
SET status = 'interrupted',
    stage_status = 'interrupted:14',
    interrupted_stage = 14,
    interrupted_at = now(),
    stage_14_output = NULL,
    stage_14_error = 'Stage 14 stopped producing output after 2 characters — the generation worker was lost mid-stream (browser navigated away). Retry this stage to regenerate.'
WHERE id = '55a48e67-b303-4b98-bb17-c2eaaa414163'
  AND stage_status = 'running:14';