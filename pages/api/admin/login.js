import crypto from 'crypto'
import { ADMIN_EMAIL, ADMIN_PASS, registerAdminToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body || {}
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  // Generate a persistent HMAC token that survives cold starts
  const token = crypto.createHmac('sha256', password)
    .update(email)
    .digest('hex')
  registerAdminToken(token)
  return res.status(200).json({ token })
}
