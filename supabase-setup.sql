-- ==========================================================================
-- IRONLOG — Supabase setup
-- Run this once in your Supabase project's SQL editor
-- (left sidebar → SQL Editor → New query → paste → Run).
-- ==========================================================================

create table if not exists ironlog_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table ironlog_states enable row level security;

create policy "Users can view their own data"
  on ironlog_states for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on ironlog_states for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on ironlog_states for update
  using (auth.uid() = user_id);
