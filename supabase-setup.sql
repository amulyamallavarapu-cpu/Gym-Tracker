-- ==========================================================================
-- GYM TRACKER — Supabase setup
-- Run this once in your Supabase project's SQL editor
-- (left sidebar → SQL Editor → New query → paste → Run).
--
-- If you already ran the old version of this script (table name
-- "ironlog_states"), just run this one line first to carry your data over,
-- then run the rest of the script below:
--   alter table if exists ironlog_states rename to gym_tracker_states;
-- ==========================================================================

create table if not exists gym_tracker_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table gym_tracker_states enable row level security;

create policy "Users can view their own data"
  on gym_tracker_states for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on gym_tracker_states for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on gym_tracker_states for update
  using (auth.uid() = user_id);
