-- (2026-11-18) The clock now calls the live address, tunga.playablegames.in (the old tunga-vs-thieves.vercel.app is on
-- the lost Vercel account and may run older game code), and only when a table really has a turn out of time — the old
-- job called the website every 5 seconds even with nobody playing. Run once in the Supabase SQL Editor.
select cron.unschedule('tunga-sweep') where exists (select 1 from cron.job where jobname = 'tunga-sweep');
select cron.schedule('tunga-sweep', '5 seconds', $$
  select net.http_post(url := 'https://tunga.playablegames.in/api/sweep', body := '{}'::jsonb)
  where exists (select 1 from public.games where status = 'playing' and deadline < (extract(epoch from now()) * 1000)::bigint)
$$);
