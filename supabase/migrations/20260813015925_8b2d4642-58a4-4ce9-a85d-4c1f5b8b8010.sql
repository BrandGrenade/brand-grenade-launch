UPDATE public.stimulus_orchestrations
SET driver_status = 'cancelled',
    error = 'Cancelled: accidental re-trigger from the Orchestration nav link. Superseded by the completed run 6a15a856.',
    phase_note = 'Cancelled — superseded by the completed run of 12 Aug 2026 12:37 UTC.'
WHERE id = '1718f86c-5b0e-4bf6-8e46-79d871c8492d';