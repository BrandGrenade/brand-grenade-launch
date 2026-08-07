update public.stimulus_directions
set rating_status='rated',
    ratings='{"fame":{"rating":"High"},"brand_glue":{"rating":"High"}}'::jsonb,
    gate_one_approved=true,
    gate_one_approved_at=now()
where id='0d406104-917c-4bbd-90ca-942965654b3e';