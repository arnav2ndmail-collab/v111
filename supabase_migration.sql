-- Run this once in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → paste → Run)

-- 1. Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS test_attempts (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id      TEXT NOT NULL,
  test_path    TEXT DEFAULT '',
  test_title   TEXT DEFAULT 'Test',
  subject      TEXT DEFAULT 'BITSAT',
  score        NUMERIC DEFAULT 0,
  max_score    NUMERIC DEFAULT 0,
  correct      INT DEFAULT 0,
  wrong        INT DEFAULT 0,
  skipped      INT DEFAULT 0,
  unattempted  INT DEFAULT 0,
  accuracy     NUMERIC DEFAULT 0,
  duration     INT DEFAULT 0,
  marks_correct NUMERIC DEFAULT 3,
  marks_wrong  NUMERIC DEFAULT 1,
  subj_stats   JSONB DEFAULT '{}',
  answers      JSONB DEFAULT '[]',
  taken_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add unique constraint so upsert (re-taking same test) works
ALTER TABLE test_attempts
  DROP CONSTRAINT IF EXISTS test_attempts_user_test_unique;
ALTER TABLE test_attempts
  ADD CONSTRAINT test_attempts_user_test_unique UNIQUE (user_id, test_id);

-- 3. Row Level Security — users can only see/edit their own attempts
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users insert own attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users delete own attempts" ON test_attempts;

-- NOTE: our API uses the service role key (bypasses RLS),
-- so these policies are a safety net for any direct client access.
CREATE POLICY "Users read own attempts"
  ON test_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own attempts"
  ON test_attempts FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_taken_at ON test_attempts(taken_at DESC);
