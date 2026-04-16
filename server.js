require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// =====================================================
// AUTH ROUTES
// =====================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, full_name, phone } = req.body;

        // Validate input
        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password and full name are required' });
        }

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert user
        const { data: user, error } = await supabase
            .from('users')
            .insert([{ email, password_hash, full_name, phone }])
            .select()
            .single();

        if (error) throw error;

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Get user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, full_name, phone, created_at')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// =====================================================
// TEST SERIES ROUTES
// =====================================================

// Get all test series
app.get('/api/test-series', authenticateToken, async (req, res) => {
    try {
        const { data: testSeries, error } = await supabase
            .from('test_series')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ testSeries });
    } catch (error) {
        console.error('Get test series error:', error);
        res.status(500).json({ error: 'Failed to fetch test series' });
    }
});

// Get single test series
app.get('/api/test-series/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: series, error } = await supabase
            .from('test_series')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ series });
    } catch (error) {
        console.error('Get test series error:', error);
        res.status(500).json({ error: 'Failed to fetch test series' });
    }
});

// =====================================================
// TESTS ROUTES
// =====================================================

// Get all tests for a series
app.get('/api/test-series/:seriesId/tests', authenticateToken, async (req, res) => {
    try {
        const { seriesId } = req.params;

        const { data: tests, error } = await supabase
            .from('tests')
            .select('*')
            .eq('test_series_id', seriesId)
            .order('test_date', { ascending: false });

        if (error) throw error;

        res.json({ tests });
    } catch (error) {
        console.error('Get tests error:', error);
        res.status(500).json({ error: 'Failed to fetch tests' });
    }
});

// =====================================================
// USER ATTEMPTS ROUTES
// =====================================================

// Get user's test attempts for a series
app.get('/api/test-series/:seriesId/my-attempts', authenticateToken, async (req, res) => {
    try {
        const { seriesId } = req.params;
        const userId = req.user.id;

        const { data: attempts, error } = await supabase
            .from('user_test_attempts')
            .select(`
                *,
                tests (
                    name,
                    test_date,
                    total_questions,
                    total_marks
                )
            `)
            .eq('user_id', userId)
            .eq('test_series_id', seriesId)
            .order('attempted_at', { ascending: false });

        if (error) throw error;

        res.json({ attempts });
    } catch (error) {
        console.error('Get attempts error:', error);
        res.status(500).json({ error: 'Failed to fetch attempts' });
    }
});

// Submit test attempt
app.post('/api/tests/:testId/submit', authenticateToken, async (req, res) => {
    try {
        const { testId } = req.params;
        const userId = req.user.id;
        const {
            total_score,
            attempted_correct,
            attempted_wrong,
            not_attempted,
            not_visited,
            accuracy,
            percentile,
            physics_score,
            chemistry_score,
            mathematics_score,
            subject_wise_data,
            time_taken_minutes,
            question_attempts
        } = req.body;

        // Get test details to get series_id
        const { data: test } = await supabase
            .from('tests')
            .select('test_series_id')
            .eq('id', testId)
            .single();

        // Insert test attempt
        const { data: attempt, error: attemptError } = await supabase
            .from('user_test_attempts')
            .insert([{
                user_id: userId,
                test_id: testId,
                test_series_id: test.test_series_id,
                total_score,
                attempted_correct,
                attempted_wrong,
                not_attempted,
                not_visited,
                accuracy,
                percentile,
                physics_score,
                chemistry_score,
                mathematics_score,
                subject_wise_data,
                time_taken_minutes
            }])
            .select()
            .single();

        if (attemptError) throw attemptError;

        // Insert question attempts if provided
        if (question_attempts && question_attempts.length > 0) {
            const questionAttemptsData = question_attempts.map(qa => ({
                attempt_id: attempt.id,
                ...qa
            }));

            const { error: qaError } = await supabase
                .from('question_attempts')
                .insert(questionAttemptsData);

            if (qaError) console.error('Question attempts error:', qaError);
        }

        res.status(201).json({
            message: 'Test attempt submitted successfully',
            attempt
        });
    } catch (error) {
        console.error('Submit test error:', error);
        res.status(500).json({ error: 'Failed to submit test attempt' });
    }
});

// Get performance summary
app.get('/api/test-series/:seriesId/performance-summary', authenticateToken, async (req, res) => {
    try {
        const { seriesId } = req.params;
        const userId = req.user.id;

        // Get all attempts for this series
        const { data: attempts, error } = await supabase
            .from('user_test_attempts')
            .select('*')
            .eq('user_id', userId)
            .eq('test_series_id', seriesId);

        if (error) throw error;

        if (!attempts || attempts.length === 0) {
            return res.json({
                summary: {
                    total_tests_attempted: 0,
                    avg_score: 0,
                    avg_accuracy: 0,
                    avg_percentile: 0,
                    best_score: 0,
                    worst_score: 0
                }
            });
        }

        // Calculate summary
        const summary = {
            total_tests_attempted: attempts.length,
            avg_score: (attempts.reduce((sum, a) => sum + a.total_score, 0) / attempts.length).toFixed(2),
            avg_accuracy: (attempts.reduce((sum, a) => sum + parseFloat(a.accuracy), 0) / attempts.length).toFixed(2),
            avg_percentile: (attempts.reduce((sum, a) => sum + (parseFloat(a.percentile) || 0), 0) / attempts.length).toFixed(2),
            best_score: Math.max(...attempts.map(a => a.total_score)),
            worst_score: Math.min(...attempts.map(a => a.total_score)),
            
            // Subject-wise averages
            avg_physics_score: (attempts.reduce((sum, a) => sum + (a.physics_score || 0), 0) / attempts.length).toFixed(2),
            avg_chemistry_score: (attempts.reduce((sum, a) => sum + (a.chemistry_score || 0), 0) / attempts.length).toFixed(2),
            avg_mathematics_score: (attempts.reduce((sum, a) => sum + (a.mathematics_score || 0), 0) / attempts.length).toFixed(2)
        };

        res.json({ summary });
    } catch (error) {
        console.error('Get performance summary error:', error);
        res.status(500).json({ error: 'Failed to fetch performance summary' });
    }
});

// =====================================================
// HEALTH CHECK
// =====================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Quizrr Analytics API is running' });
});

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Quizrr Analytics API`);
    console.log(`🔗 http://localhost:${PORT}`);
});

module.exports = app;
