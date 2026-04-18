// pages/api/test/[...filePath].js
// Serves test JSON from either:
//   - local public/tests/ folder
//   - Supabase Storage (when filePath starts with __storage__)

import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const { filePath } = req.query
  if (!filePath) return res.status(400).end()

  const parts = Array.isArray(filePath) ? filePath : [filePath]
  const joined = parts.join('/')

  // ── Supabase Storage path ─────────────────────────────────────────────────
  if (joined.startsWith('__storage__')) {
    const storageKey = joined.replace('__storage__', '')
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    if (!sbUrl || !sbKey) return res.status(503).json({ error: 'Supabase not configured' })
    try {
      const publicUrl = `${sbUrl}/storage/v1/object/public/tests/${storageKey}`
      const r = await fetch(publicUrl)
      if (!r.ok) return res.status(404).json({ error: `Storage file not found: ${storageKey}` })
      const d = await r.json()
      return res.status(200).json(d)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // ── Local public/tests/ file ──────────────────────────────────────────────
  const base = path.join(process.cwd(), 'public', 'tests')
  const safe = path.join(base, ...parts)
  if (!safe.startsWith(base)) return res.status(403).end()
  if (!fs.existsSync(safe)) return res.status(404).end()
  try {
    res.status(200).json(JSON.parse(fs.readFileSync(safe, 'utf8')))
  } catch {
    res.status(500).end()
  }
}
