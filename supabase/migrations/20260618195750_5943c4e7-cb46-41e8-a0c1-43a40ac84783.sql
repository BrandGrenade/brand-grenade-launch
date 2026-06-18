UPDATE public.sessions
SET stage_20_output = regexp_replace(
  regexp_replace(stage_20_output, 'Distinctive Assets\s*[—–-]\s*', 'Distinctive Asset Integration: ', 'g'),
  '(Emotional Clarity|Fame Invitation|Distinctive Asset Integration|Psychological Leverage|Creative SoV Ambition|COMPOSITE|STATUS)\s*[—–]\s*',
  '\1: ',
  'g'
)
WHERE id IN (
  '7631768a-6846-43ba-a3b2-b9069d2ef37a',
  '7b8b2971-ded6-4c93-a9b6-bb5d3eea7ad8',
  '3a2e2cd0-f9a3-46a2-8449-33ea78be9ec1'
);