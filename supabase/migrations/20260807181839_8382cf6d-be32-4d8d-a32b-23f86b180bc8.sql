UPDATE public.stimulus_prompts SET mandate_compliance = 'absent' WHERE id = 'a2cc71f7-09c3-4b39-969e-a433fe4db95d'::uuid;
UPDATE public.stimulus_prompts SET mandate_compliance = 'absent' WHERE id = '85ccfdb5-906f-4c7d-8aa4-e3a02f19a36d'::uuid;
UPDATE public.stimulus_orchestrations SET gate_two_confirmed = false, gate_two_confirmed_at = null WHERE id = '7206ff6e-4b1a-4de8-a8f3-e82285184178'::uuid;