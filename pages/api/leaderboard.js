// pages/api/leaderboard.js
// GET ?testId=xxx → returns top 50 scores for that test with user names + caller's rank

import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const sb = getAdmin()
  if (!sb) return res.status(503).json({ error: 'Not configured' })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { testId } = req.query
  if (!testId) return res.status(400).json({ error: 'testId required' })

  // Get all attempts for this test
  const { data: attempts, error } = await sb
    .from('test_attempts')
    .select('user_id, score, max_score, accuracy, correct, wrong, taken_at, test_title')
    .eq('test_id', testId)
    .order('score', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ error: error.message })

  // Get user metadata (names) for all user_ids
  const userIds = [...new Set((attempts || []).map(a => a.user_id))]
  const nameMap = {}
  for (const uid of userIds) {
    try {
      const { data: { user: u } } = await sb.auth.admin.getUserById(uid)
      nameMap[uid] = u?.user_metadata?.full_name || u?.email?.split('@')[0] || 'Anonymous'
    } catch(e) { nameMap[uid] = 'Anonymous' }
  }

  const ranked = (attempts || []).map((a, i) => ({
    rank: i + 1,
    name: nameMap[a.user_id] || 'Anonymous',
    isYou: a.user_id === user.id,
    score: a.score,
    maxScore: a.max_score,
    accuracy: a.accuracy,
    correct: a.correct,
    wrong: a.wrong,
    takenAt: a.taken_at,
  }))

  const myRank = ranked.find(r => r.isYou)

  return res.status(200).json({ leaderboard: ranked.slice(0, 50), myRank: myRank || null, total: ranked.length })
}
