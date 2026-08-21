CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('reliability-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reliability-tick'
);

SELECT cron.schedule(
  'reliability-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--00f8f168-9af0-4e35-a994-3f3194d41422.lovable.app/api/public/reliability-tick',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltcnR1d3R5YnN6YXJwb3RteGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzY0NTAsImV4cCI6MjA5NDgxMjQ1MH0.2jMz8eRvCSeq5Iu3q8NPbqYy-PqJZ2SfCqVXiGI2jyo"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);