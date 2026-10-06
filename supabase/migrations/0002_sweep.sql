-- The server's clock: every 5 seconds, close any room whose decision deadline has passed, even when every
-- phone is asleep (players on a call switch apps). Run once in the Supabase SQL Editor.
create index if not exists games_due on public.games (status, deadline);

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('tunga-sweep') where exists (select 1 from cron.job where jobname = 'tunga-sweep');
select cron.schedule('tunga-sweep', '5 seconds',
  $$ select net.http_post(url := 'https://tunga-vs-thieves.vercel.app/api/sweep', body := '{}'::jsonb) $$);
