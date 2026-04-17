-- ============================================================
-- TestZyro — Run this in Supabase SQL Editor
-- ============================================================

-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text default '',
  created_at timestamptz default now()
);

-- Test attempts (stores every completed test)
create table if not exists test_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  test_id text not null default '',
  test_path text default '',
  test_title text not null default 'Test',
  subject text default 'BITSAT',
  score integer not null default 0,
  max_score integer not null default 0,
  correct integer not null default 0,
  wrong integer not null default 0,
  skipped integer default 0,
  unattempted integer default 0,
  accuracy integer default 0,
  duration integer default 0,
  marks_correct integer default 3,
  marks_wrong integer default 1,
  subj_stats jsonb default '{}',
  answers jsonb default '[]',
  taken_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table test_attempts enable row level security;

-- DROP old policies if they exist (re-runnable)
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "attempts_select" on test_attempts;
drop policy if exists "attempts_insert" on test_attempts;
drop policy if exists "attempts_delete" on test_attempts;

-- Profiles policies
create policy "profiles_select" on profiles for select using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Attempts policies — these are what you need for client-side save
create policy "attempts_select" on test_attempts for select using (auth.uid() = user_id);
create policy "attempts_insert" on test_attempts for insert with check (auth.uid() = user_id);
create policy "attempts_delete" on test_attempts for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- IMPORTANT: In Supabase Dashboard → Authentication → Settings
-- → "Enable email confirmations" → TURN OFF → Save
-- ============================================================
