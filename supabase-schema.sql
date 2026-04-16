-- ============================================================
-- TestZyro Database Schema — Run this in Supabase SQL Editor
-- ============================================================

-- 1. Profiles (auto-created on signup)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  created_at timestamptz default now()
);

-- 2. Test Attempts (stores every test a student gives)
create table if not exists test_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  test_id text not null,
  test_path text,
  test_title text not null,
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

-- Profiles policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Attempts policies
create policy "Users can view own attempts" on test_attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts" on test_attempts for insert with check (auth.uid() = user_id);
create policy "Users can delete own attempts" on test_attempts for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- IMPORTANT SETTINGS (do in Supabase Dashboard):
-- 1. Authentication → Settings → Email confirmations: DISABLE
-- 2. Authentication → Settings → Minimum password length: 6
-- ============================================================
