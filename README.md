# TestZyro — Setup Guide

## Step 1: Supabase Setup

### 1a. Create free account
Go to https://supabase.com → New project

### 1b. Disable email confirmation (REQUIRED for no-email signup)
Supabase Dashboard → Authentication → Settings → scroll to "Email Auth"
→ **Disable "Enable email confirmations"** → Save

### 1c. Run the SQL schema
Supabase Dashboard → SQL Editor → New query
→ Paste the contents of `supabase-schema.sql` → Run

### 1d. Get your keys
Supabase Dashboard → Settings → API:
- **Project URL** = `NEXT_PUBLIC_SUPABASE_URL`
- **Publishable/anon key** = `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

---

## Step 2: Deploy to Vercel

1. Push this code to GitHub
2. Go to vercel.com → New Project → Import your repo
3. In **Environment Variables** add:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://kgqxukyytpvmblypuaxw.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_MGWDvr-TOZtMp8tWERdk-Q_2pIMPd65
   ```
4. Deploy!

---

## Step 3: Upload Tests

### Option A — Static files (recommended, free, fast)
Put JSON test files in `public/tests/BITSAT/` folder:
```
public/
  tests/
    BITSAT/
      bitsat_paper_1.json
      bitsat_paper_2.json
    JEE/
      jee_paper_1.json
```
Then redeploy to Vercel. Tests appear automatically in the library.

### Option B — Generate from ZIP
Go to `/admin` → BITSAT ZIP tab → Upload your zip → Download JSON → put in `public/tests/BITSAT/`

### Test JSON format
```json
{
  "title": "BITSAT Paper 1",
  "subject": "BITSAT",
  "dur": 180,
  "mCor": 3,
  "mNeg": 1,
  "questions": [
    {
      "subject": "Physics",
      "type": "MCQ",
      "text": "Question text here",
      "opts": ["Option A", "Option B", "Option C", "Option D"],
      "ans": "A"
    }
  ]
}
```

---

## Pages
- `/` — Test library (give tests)
- `/login` — Login / Sign up
- `/analytics` — Your performance analytics (Quizrr-style)
- `/analyser` — Upload result file for analysis
- `/bookmarks` — Saved questions
- `/solutions` — PDF answer keys
- `/admin` — Upload ZIP files, manage tests

## Notes
- All test data is stored per-user in Supabase
- Works offline too (data saved in localStorage as backup)
- Tests are static files — no database needed for test content
