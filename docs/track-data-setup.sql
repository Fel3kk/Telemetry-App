-- Run in the SQL Editor of the existing account database.
-- Safe to run again; no existing track maps or lines are deleted.
create table if not exists public.user_track_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('racing_line', 'ers')),
  track_slug text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, track_slug)
);
grant select, insert, update, delete on public.user_track_data to authenticated;
grant all on public.user_track_data to service_role;
alter table public.user_track_data enable row level security;
drop policy if exists "own track data" on public.user_track_data;
create policy "own track data" on public.user_track_data
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);