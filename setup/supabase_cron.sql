-- Enable pg_cron, pg_net, and Vault in Supabase Dashboard → Database → Extensions.
-- Run this file ONCE after replacing the two placeholders below.
-- The secret is kept in Vault rather than hard-coded into the cron job itself.
SELECT vault.create_secret('https://YOUR-PROJECT.vercel.app/api/cron','autojuben_cron_endpoint');
SELECT vault.create_secret('THE_SAME_CRON_SECRET_AS_VERCEL_ENV','autojuben_cron_secret');

-- Every minute: securely invoke the Vercel serverless worker. One run handles a small batch;
-- database leases prevent a second run from claiming the same task.
SELECT cron.schedule('autojuben-video-worker','* * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='autojuben_cron_endpoint' LIMIT 1),
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='autojuben_cron_secret' LIMIT 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- Check status: SELECT jobid,jobname,schedule,active FROM cron.job WHERE jobname='autojuben-video-worker';
-- Monitor: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- Stop: SELECT cron.unschedule('autojuben-video-worker');
