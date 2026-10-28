UPDATE public.stimulus_orchestrations
SET test_faults = jsonb_build_object(
  'mandate_channel', 'Large-format Roadside and Commuter Outdoor',
  'fidelity_channel', 'Podcast and In-car Radio',
  'enabled_at', now(), 'enabled_by', 'Adrian Pritchard (approved 28 Oct 2026)',
  'reason', 'Test-only: force one mandate failure and one fidelity score below 6')
WHERE id = '60b823c8-1cc0-4c12-955b-644dda62ba84';