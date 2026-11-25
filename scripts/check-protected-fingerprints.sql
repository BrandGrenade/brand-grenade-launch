-- Permanent read-only check. Run before/after changes using the database read-query tool.
-- Baseline: Foundations follow-up / 25 Nov 2026. Empty-separator, UUID-ordered JSONB rows.
-- The additive exploration_brief column did not exist when those fingerprints were taken.
-- Only the two explicitly authorised exploration test records are excluded from the old inventory.
WITH rows AS (
 SELECT 'sessions' kind,id,to_jsonb(s)-'exploration_brief' row FROM public.sessions s
 WHERE s.id NOT IN ('06134f96-23c8-43cb-9b5d-5fcfc609964f','e2d7fb33-ef91-46db-a609-0d13bb43b408')
 UNION ALL SELECT 'baselines',id,to_jsonb(s) FROM public.current_position_addon_jobs s
 UNION ALL SELECT 'validate',id,to_jsonb(s) FROM public.validate_assessments s
 UNION ALL SELECT 'versions',id,to_jsonb(s) FROM public.run_output_versions s
 WHERE s.run_id NOT IN ('06134f96-23c8-43cb-9b5d-5fcfc609964f','e2d7fb33-ef91-46db-a609-0d13bb43b408')
 UNION ALL SELECT 'gate_two',id,to_jsonb(s) FROM public.stimulus_orchestrations s
), expected(kind,fingerprint) AS (VALUES
 ('sessions','4fa93a5e5fa158c18e092e7e08f2060a'),
 ('baselines','0cd6db6e466f41ef71d9ca5342c3085f'),
 ('validate','1be5a7505f9d77002311df531d9d9a97'),
 ('versions','7cd6a6a768ab6f21a6f5655fd600dbaf'),
 ('gate_two','3d127251cd990ec35250e9ef9b894011')
), actual AS (SELECT kind,count(*) count,md5(string_agg(row::text,'' ORDER BY id)) fingerprint FROM rows GROUP BY kind)
SELECT a.*,e.fingerprint expected,a.fingerprint=e.fingerprint unchanged FROM actual a JOIN expected e USING(kind) ORDER BY kind;