import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return res.status(200).json({ ok: false, reason: 'DB not configured' })

  const sb = createClient(url, key)

  // Auth from bearer token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const b = req.body
  const { error } = await sb.from('test_attempts').insert({
    user_id: user.id,
    test_id: b.testId || b.testPath || 'unknown',
    test_path: b.testPath || '',
    test_title: b.testTitle || 'Test',
    subject: b.subject || 'BITSAT',
    score: b.score || 0,
    max_score: b.maxScore || 0,
    correct: b.correct || 0,
    wrong: b.wrong || 0,
    skipped: b.skipped || 0,
    unattempted: b.unattempted || 0,
    accuracy: b.accuracy || 0,
    duration: b.duration || 0,
    marks_correct: b.marksCorrect || 3,
    marks_wrong: b.marksWrong || 1,
    subj_stats: b.subjStats || {},
    answers: b.answers || [],
    taken_at: new Date().toISOString()
  })

  if (error) {
    console.error('save-attempt error:', error.message)
    return res.status(500).json({ error: error.message })
  }
  return res.status(200).json({ ok: true })
}
