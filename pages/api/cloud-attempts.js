// pages/api/cloud-attempts.js
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

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('test_attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json((data || []).map(row => ({
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
      answers: row.answers,
    })))
  }

  // ── POST — use raw SQL INSERT ... ON CONFLICT ... DO UPDATE ───────────────
  if (req.method === 'POST') {
    const b = req.body
    const testId = b.testId || b.testPath || 'unknown'

    // Raw SQL guarantees atomic upsert — no race between delete and insert
    const { data, error } = await sb.rpc('upsert_test_attempt', {
      p_user_id:      user.id,
      p_test_id:      testId,
      p_test_path:    b.testPath || '',
      p_test_title:   b.testTitle || 'Test',
      p_subject:      b.subject || 'Exam',
      p_score:        b.score ?? 0,
      p_max_score:    b.maxScore ?? 0,
      p_correct:      b.correct ?? 0,
      p_wrong:        b.wrong ?? 0,
      p_skipped:      b.skipped ?? 0,
      p_unattempted:  b.unattempted ?? 0,
      p_accuracy:     b.accuracy ?? 0,
      p_duration:     b.duration ?? 0,
      p_marks_correct: b.marksCorrect ?? 3,
      p_marks_wrong:  b.marksWrong ?? 1,
      p_subj_stats:   JSON.stringify(b.subjStats || {}),
      p_answers:      JSON.stringify(b.answers || []),
    })

    if (error) {
      console.error('upsert_test_attempt error:', error)
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true, id: data })
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
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
