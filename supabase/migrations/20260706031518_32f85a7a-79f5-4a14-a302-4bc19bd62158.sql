UPDATE public.sessions
SET
  status = 'interrupted',
  stage_status = 'interrupted:6',
  interrupted_stage = 6,
  stage_6_error = 'Stage 6 stream stalled with no output heartbeat; released for retry.',
  retry_status = NULL
WHERE id = 'b476397f-1cd6-4135-b302-76b755e124ba'
  AND status = 'running'
  AND current_stage = 6
  AND COALESCE(stage_6_output, '') = '';