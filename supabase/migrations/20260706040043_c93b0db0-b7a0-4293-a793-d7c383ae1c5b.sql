update public.sessions
set status = 'interrupted',
    stage_status = 'complete:7',
    stage_7_error = null
where id = 'b476397f-1cd6-4135-b302-76b755e124ba'
  and coalesce(length(stage_7_output), 0) > 0;