-- Optional operational task. Run after enabling pg_cron in Supabase.
-- Use only after sql/005_api_quality.sql and test in staging first.
-- Keep minimal 90-day API metadata; never archive request bodies or payment secrets.
SELECT cron.schedule(
  'autojuben-api-metrics-retention',
  '15 3 * * *',
  $$DELETE FROM public.api_request_metrics WHERE occurred_at<now()-interval '90 days'$$
);
