-- Tunga vs Thieves Online. Clients NEVER read these tables: RLS is on with no policies,
-- so only the server (service role) can. Phones get their redacted view from the API,
-- and Realtime only carries a "version changed" ping on the public channel game:<code>.

create table if not exists public.games (
  code        text primary key,
  version     integer not null,
  status      text not null check (status in ('lobby', 'playing', 'over')),
  host_token  text not null,
  lobby       jsonb not null,          -- [{ name, token }] in seat order once started
  state       jsonb,                   -- full engine state incl. every hidden event (the playtest log)
  deadline    bigint,                  -- ms epoch; when the current decision times out
  timers      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id          bigserial primary key,
  code        text not null references public.games(code) on delete cascade,
  seat        integer not null,
  name        text not null,
  text        text not null,
  phase       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_code_id on public.messages (code, id);

alter table public.games    enable row level security;
alter table public.messages enable row level security;
-- (no policies on purpose)

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists games_touch on public.games;
create trigger games_touch before update on public.games for each row execute function public.touch_updated_at();
