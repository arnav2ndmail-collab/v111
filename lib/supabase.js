import { createClient as createBrowserClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _client = null

export function getSupabase() {
  if (!_client && SUPABASE_URL && SUPABASE_KEY) {
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
  }
  return _client
}

export function isSupabaseReady() {
  return !!(SUPABASE_URL && SUPABASE_KEY)
}
