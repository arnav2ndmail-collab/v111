# Add these in Vercel → Project Settings → Environment Variables

| Variable Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hzmtzqrozgtdkpkcedql.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (your publishable key from Supabase Settings → API) |

## Steps:
1. Go to vercel.com → your project → Settings → Environment Variables
2. Add both variables above
3. Redeploy (Deployments → click latest → Redeploy)

## Get your key:
Supabase Dashboard → Settings (gear icon) → API
→ Copy "Project URL" and "anon public" key

## IMPORTANT - Disable email confirmation:
Supabase → Authentication → Settings → Email Auth
→ "Enable email confirmations" → OFF → Save
