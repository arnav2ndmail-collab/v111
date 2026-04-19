# Karle — Vercel Environment Variables

Add these in: Vercel → Project → Settings → Environment Variables

| Variable | Value | Required for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kgqxukyytpvmblypuaxw.supabase.co` | Everything |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_MGWDvr...` | Login, saving scores |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (from Supabase Settings → API → service_role) | **Loading tests from Storage** |

## Why two keys?
- **Publishable key** = safe to expose in browser. Used for login, saving test attempts.
- **Service role key** = secret, powerful. Used SERVER-SIDE to list files in Storage.
  The anon key cannot list private storage files — that's why tests weren't showing.

## Get Service Role Key:
1. Supabase Dashboard → Settings (gear icon) → API
2. Under "Project API keys" → copy **service_role** key (starts with `eyJ...`)
3. Add to Vercel as `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy

## Upload Tests to Storage:
1. Supabase → Storage → Create bucket "tests" (set to PUBLIC)  
2. Create folder: `BITSAT/`
3. Upload `.json` test files inside `BITSAT/`
4. Tests appear in Karle library automatically

## Supabase Auth Setup:
- Authentication → Settings → Email Auth → "Enable email confirmations" → **OFF**
- Run `supabase-schema.sql` in SQL Editor
