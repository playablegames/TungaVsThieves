-- (2026-11-24, owner) Optional WhatsApp number / email typed on the name sheet, for the Playable Games WhatsApp group.
-- Kept apart from games: the 90-day game sweep does not touch it. Kept until the person asks to be removed.
-- Only the server (service role) reads it: RLS on, no policies. Run once in the Supabase SQL Editor of the Tunga project.
create table if not exists public.contacts (
  id          bigserial primary key,
  name        text not null default '',
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  check (phone is not null or email is not null)
);
alter table public.contacts enable row level security;
-- (no policies on purpose)
