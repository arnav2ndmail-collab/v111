// pages/api/admin/upload-to-storage.js
import { verifyAdminToken } from '../../../lib/auth'

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const tok = (req.headers.authorization || '').replace('Bearer ', '')
  if (!verifyAdminToken(tok)) return res.status(401).json({ error: 'Unauthorized' })

  const { testData, storagePath } = req.body
  if (!testData || !storagePath) return res.status(400).json({ error: 'Missing testData or storagePath' })

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!sbUrl || !sbKey) return res.status(503).json({ error: 'Supabase not configured' })

  const jsonBuffer = Buffer.from(JSON.stringify(testData))

  const r = await fetch(`${sbUrl}/storage/v1/object/tests/${storagePath}`, {
    method: 'POST',
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true'
    },
    body: jsonBuffer
  })

  if (!r.ok) {
    const err = await r.text()
    return res.status(500).json({ error: err })
  }

  return res.status(200).json({ ok: true, path: storagePath })
}
