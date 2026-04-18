-- ============================================================
-- TestZyro / Karle — Full Database Reset & Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- WARNING: Drops all existing data
-- ============================================================

-- ── 1. Drop existing tables ──────────────────────────────────
DROP TABLE IF EXISTS user_bookmarks CASCADE;
DROP TABLE IF EXISTS test_attempts CASCADE;

-- ── 2. test_attempts ─────────────────────────────────────────
CREATE TABLE test_attempts (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id       TEXT NOT NULL,
  test_path     TEXT DEFAULT '',
  test_title    TEXT DEFAULT 'Test',
  subject       TEXT DEFAULT 'BITSAT',
  score         NUMERIC DEFAULT 0,
  max_score     NUMERIC DEFAULT 0,
  correct       INT DEFAULT 0,
  wrong         INT DEFAULT 0,
  skipped       INT DEFAULT 0,
  unattempted   INT DEFAULT 0,
  accuracy      NUMERIC DEFAULT 0,
  duration      INT DEFAULT 0,
  marks_correct NUMERIC DEFAULT 3,
  marks_wrong   NUMERIC DEFAULT 1,
  subj_stats    JSONB DEFAULT '{}',
  answers       JSONB DEFAULT '[]',
  taken_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT test_attempts_user_test_unique UNIQUE (user_id, test_id)
);

-- Indexes
CREATE INDEX idx_test_attempts_user_id  ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_taken_at ON test_attempts(taken_at DESC);
CREATE INDEX idx_test_attempts_subject  ON test_attempts(subject);

-- RLS
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own attempts"
  ON test_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own attempts"
  ON test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own attempts"
  ON test_attempts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own attempts"
  ON test_attempts FOR DELETE
  USING (auth.uid() = user_id);

-- ── 3. user_bookmarks ────────────────────────────────────────
CREATE TABLE user_bookmarks (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmarks  JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bookmarks"
  ON user_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. site_config (exam dates, announcements) ───────────────
DROP TABLE IF EXISTS site_config CASCADE;
CREATE TABLE site_config (
  key        TEXT PRIMARY KEY,
  value      JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Seed with empty exams
INSERT INTO site_config (key, value) VALUES ('exams', '[]');

-- Allow public read (for exam countdown tiles on homepage)
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_config"
  ON site_config FOR SELECT USING (true);

-- ── 5. Auto-update updated_at on bookmarks ───────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_bookmarks_updated_at
  BEFORE UPDATE ON user_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Done ─────────────────────────────────────────────────────
SELECT 'Setup complete ✓' AS status;
