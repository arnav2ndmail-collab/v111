import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken } from '../../../lib/auth'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const sb = getAdmin()
  if (!sb) return res.status(503).json({ error: 'Not configured' })

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('site_config').select('value').eq('key', 'test_schedules').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data?.value || [])
  }

  if (req.method === 'POST') {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' })
    const { schedules } = req.body
    const { error } = await sb
      .from('site_config')
      .upsert({ key: 'test_schedules', value: schedules || [] }, { onConflict: 'key' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
