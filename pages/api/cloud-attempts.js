// pages/api/cloud-attempts.js
// Cross-device attempt sync using Supabase with service role key (server-side).
// GET  ?userId=xxx        → returns all attempts for user
// POST                    → saves an attempt (body must include userId)
// DELETE ?id=xxx&userId=xxx → deletes one attempt

import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  const sb = getAdmin()
  if (!sb) return res.status(503).json({ error: 'Supabase not configured' })

  // Verify the JWT token sent from the browser
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // ── GET — load all attempts ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('test_attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    // Map DB rows → frontend attempt shape
    const attempts = (data || []).map(row => ({
      id: row.id,
      testId: row.test_id,
      testPath: row.test_path,
      testTitle: row.test_title,
      subject: row.subject,
      date: row.taken_at,
      score: row.score,
      maxScore: row.max_score,
      accuracy: row.accuracy,
      correct: row.correct,
      wrong: row.wrong,
      skipped: row.skipped,
      unattempted: row.unattempted,
      duration: row.duration,
      marksCorrect: row.marks_correct,
      marksWrong: row.marks_wrong,
      subjStats: row.subj_stats,
      answers: row.answers, // array of {yourAnswer, correctAnswer, result}
    }))
    return res.status(200).json(attempts)
  }

  // ── POST — save an attempt ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const b = req.body
    // Upsert by test_id + user_id so re-taking replaces old row
    const { data, error } = await sb
      .from('test_attempts')
      .upsert({
        user_id: user.id,
        test_id: b.testId || b.testPath || 'unknown',
        test_path: b.testPath || '',
        test_title: b.testTitle || 'Test',
        subject: b.subject || 'BITSAT',
        score: b.score ?? 0,
        max_score: b.maxScore ?? 0,
        correct: b.correct ?? 0,
        wrong: b.wrong ?? 0,
        skipped: b.skipped ?? 0,
        unattempted: b.unattempted ?? 0,
        accuracy: b.accuracy ?? 0,
        duration: b.duration ?? 0,
        marks_correct: b.marksCorrect ?? 3,
        marks_wrong: b.marksWrong ?? 1,
        subj_stats: b.subjStats || {},
        answers: b.answers || [],
        taken_at: new Date().toISOString(),
      }, { onConflict: 'user_id,test_id' })
      .select('id')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, id: data?.id })
  }

  // ── DELETE — remove an attempt ───────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'No id' })
    const { error } = await sb
      .from('test_attempts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
