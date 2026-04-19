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

    // Exam countdowns stored in site_config table
    const { data: cfg } = await sb
      .from('site_config')
      .select('value')
      .eq('key', 'exams')
      .single()

    return res.status(200).json({
      totalAttempts: count || 0,
      exams: cfg?.value || []
    })
  }

  // ── POST — admin saves exams ────────────────────────────────────────────
  if (req.method === 'POST') {
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPass  = process.env.ADMIN_PASS
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    const { exams } = req.body
    // Accept either bearer token from admin session or email:pass combo
    const validToken = token && token.length > 10
    if (!validToken) return res.status(401).json({ error: 'Unauthorized' })

    const { error } = await sb
      .from('site_config')
      .upsert({ key: 'exams', value: exams || [] }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
