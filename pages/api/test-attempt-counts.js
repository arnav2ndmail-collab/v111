// Returns attempt counts per test_id for showing on library
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return res.status(200).json({})
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await sb.from('test_attempts').select('test_id')
  const counts = {}
  ;(data||[]).forEach(r => { counts[r.test_id] = (counts[r.test_id]||0) + 1 })
  return res.status(200).json(counts)
}
