// pages/api/admin/users.js
// Returns list of all users with attempt counts - admin only

import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken } from '../../../lib/auth'

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return res.status(503).json({ error: 'Supabase not configured' })

  const sb = createClient(url, key, { auth: { persistSession: false } })

  // Get all users from auth.users via admin API
  const { data: { users }, error } = await sb.auth.admin.listUsers()
  if (error) return res.status(500).json({ error: error.message })

  // Get attempt counts per user
  const { data: counts } = await sb
    .from('test_attempts')
    .select('user_id')

  const countMap = {}
  ;(counts || []).forEach(r => {
    countMap[r.user_id] = (countMap[r.user_id] || 0) + 1
  })

  const result = (users || []).map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at,
    attempt_count: countMap[u.id] || 0,
  })).sort((a, b) => b.attempt_count - a.attempt_count)

  return res.status(200).json(result)
}
