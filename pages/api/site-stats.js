// pages/api/site-stats.js
// GET  → returns { totalAttempts, exams }
// POST → admin only — save exams list

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

  // ── GET — public stats ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Total attempts across all users
    const { count } = await sb
      .from('test_attempts')
      .select('*', { count: 'exact', head: true })

    // Exam countdowns
    const { data: cfg } = await sb.from('site_config').select('value').eq('key', 'exams').maybeSingle()
    // Announcement banner
    const { data: ann } = await sb.from('site_config').select('value').eq('key', 'announcement').maybeSingle()

    return res.status(200).json({
      totalAttempts: count || 0,
      exams: cfg?.value || [],
      announcement: ann?.value || null
    })
  }

  // ── POST — admin saves exams ────────────────────────────────────────────
  if (req.method === 'POST') {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    const validToken = token && token.length > 10
    if (!validToken) return res.status(401).json({ error: 'Unauthorized' })

    const { exams, announcement } = req.body
    const ops = []
    if (exams !== undefined) ops.push(sb.from('site_config').upsert({ key: 'exams', value: exams || [] }, { onConflict: 'key' }))
    if (announcement !== undefined) ops.push(sb.from('site_config').upsert({ key: 'announcement', value: announcement }, { onConflict: 'key' }))
    const results = await Promise.all(ops)
    const err = results.find(r => r.error)
    if (err) return res.status(500).json({ error: err.error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
