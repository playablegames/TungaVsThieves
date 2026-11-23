-- (2026-11-23, owner: "90 days") A game and everything sent in it is deleted 90 days after its last move, as the
-- Privacy page says. Runs every night at 03:00 IST (21:30 UTC). Messages go with their game (on delete cascade).
-- Run once in the Supabase SQL Editor of the Tunga project.
select cron.unschedule('tunga-keep-90-days') where exists (select 1 from cron.job where jobname = 'tunga-keep-90-days');
select cron.schedule('tunga-keep-90-days', '30 21 * * *', $$
  delete from public.games where updated_at < now() - interval '90 days'
$$);
