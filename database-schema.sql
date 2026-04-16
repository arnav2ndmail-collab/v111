-- =====================================================
-- QUIZRR ANALYTICS DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TEST SERIES TABLE
-- =====================================================
CREATE TABLE test_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    exam_type VARCHAR(50) NOT NULL, -- 'JEE', 'NEET', 'BITSAT', etc.
    total_tests INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TESTS TABLE
-- =====================================================
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_series_id UUID REFERENCES test_series(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    test_date DATE NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 75,
    total_marks INTEGER NOT NULL DEFAULT 300,
    duration_minutes INTEGER NOT NULL DEFAULT 180,
    subjects JSONB NOT NULL DEFAULT '["Physics", "Chemistry", "Mathematics"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- USER TEST ATTEMPTS TABLE
-- =====================================================
CREATE TABLE user_test_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    test_series_id UUID REFERENCES test_series(id) ON DELETE CASCADE,
    
    -- Overall scores
    total_score INTEGER NOT NULL,
    attempted_correct INTEGER NOT NULL,
    attempted_wrong INTEGER NOT NULL,
    not_attempted INTEGER NOT NULL,
    not_visited INTEGER NOT NULL,
    accuracy DECIMAL(5,2) NOT NULL,
    percentile DECIMAL(5,2),
    
    -- Subject-wise scores (JSONB for flexibility)
    physics_score INTEGER,
    chemistry_score INTEGER,
    mathematics_score INTEGER,
    
    -- Detailed breakdown
    subject_wise_data JSONB, -- Contains detailed subject breakdown
    time_taken_minutes INTEGER,
    
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, test_id)
);

-- =====================================================
-- QUESTION ATTEMPTS TABLE (Detailed tracking)
-- =====================================================
CREATE TABLE question_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES user_test_attempts(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    subject VARCHAR(50) NOT NULL,
    topic VARCHAR(255),
    difficulty VARCHAR(20), -- 'Easy', 'Medium', 'Hard'
    
    is_attempted BOOLEAN NOT NULL,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    marked_for_review BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES for better performance
-- =====================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_test_series_exam_type ON test_series(exam_type);
CREATE INDEX idx_tests_series ON tests(test_series_id);
CREATE INDEX idx_tests_date ON tests(test_date);
CREATE INDEX idx_attempts_user ON user_test_attempts(user_id);
CREATE INDEX idx_attempts_test ON user_test_attempts(test_id);
CREATE INDEX idx_attempts_series ON user_test_attempts(test_series_id);
CREATE INDEX idx_question_attempts_attempt ON question_attempts(attempt_id);

-- =====================================================
-- INSERT SAMPLE TEST SERIES
-- =====================================================
INSERT INTO test_series (name, description, exam_type, total_tests) VALUES
('JEE Main 2026 Full Test Series for Dropper (August Batch)', 'Complete test series for JEE Main 2026 preparation', 'JEE', 30),
('NEET 2026 Complete Test Series', 'Full length tests for NEET 2026', 'NEET', 25),
('BITSAT 2026 Mock Tests', 'BITSAT preparation test series', 'BITSAT', 20);

-- =====================================================
-- SAMPLE TESTS (You'll add more via API)
-- =====================================================
INSERT INTO tests (test_series_id, name, test_date, total_questions, total_marks, duration_minutes)
SELECT 
    id,
    'Quizrr Full Test (QFT) - ' || generate_series,
    CURRENT_DATE - (generate_series || ' days')::interval,
    75,
    300,
    180
FROM test_series, generate_series(1, 10)
WHERE exam_type = 'JEE'
LIMIT 10;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Important for Supabase
-- =====================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Test series are public (read-only)
CREATE POLICY "Anyone can view test series" ON test_series
    FOR SELECT USING (true);

-- Tests are public (read-only)
CREATE POLICY "Anyone can view tests" ON tests
    FOR SELECT USING (true);

-- Users can only see their own attempts
CREATE POLICY "Users can view own attempts" ON user_test_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts" ON user_test_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see their own question attempts
CREATE POLICY "Users can view own question attempts" ON question_attempts
    FOR SELECT USING (
        attempt_id IN (
            SELECT id FROM user_test_attempts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own question attempts" ON question_attempts
    FOR INSERT WITH CHECK (
        attempt_id IN (
            SELECT id FROM user_test_attempts WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS for common queries
-- =====================================================

-- Function to get user performance summary
CREATE OR REPLACE FUNCTION get_user_performance_summary(p_user_id UUID, p_test_series_id UUID)
RETURNS TABLE (
    total_tests_attempted INTEGER,
    avg_score DECIMAL,
    avg_accuracy DECIMAL,
    avg_percentile DECIMAL,
    best_score INTEGER,
    worst_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_tests_attempted,
        AVG(total_score)::DECIMAL as avg_score,
        AVG(accuracy)::DECIMAL as avg_accuracy,
        AVG(percentile)::DECIMAL as avg_percentile,
        MAX(total_score)::INTEGER as best_score,
        MIN(total_score)::INTEGER as worst_score
    FROM user_test_attempts
    WHERE user_id = p_user_id 
    AND test_series_id = p_test_series_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_series_updated_at BEFORE UPDATE ON test_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
