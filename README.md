# TestZyro — Complete Setup Guide

---

## THE BANDWIDTH PROBLEM (WHY VERCEL STOPPED YOU)

Your tests had images stored as **base64 inside JSON files** in the `public/` folder.
Every time someone loaded a test, Vercel served those huge image files directly.
With many students, 10GB disappears in 2 days.

### THE FIX: Store tests in Supabase Storage (free, 1GB)

**Do NOT put test JSONs in the `public/` folder anymore.**
Upload them to Supabase Storage → they are served from Supabase's CDN, not Vercel.

---

## STEP 1 — Supabase Setup (One time, free)

### 1a. Create account
Go to → https://supabase.com → Sign Up → New Project

### 1b. Disable email confirmation ← REQUIRED
```
Supabase Dashboard
→ Authentication
→ Settings
→ Email Auth section
→ "Enable email confirmations" → TURN OFF
→ Save
```

### 1c. Run SQL schema
```
Supabase Dashboard → SQL Editor → New Query
→ Paste contents of supabase-schema.sql
→ Click RUN
```

### 1d. Create Storage bucket for tests
```
Supabase Dashboard → Storage → New bucket
→ Name: tests
→ Public bucket: YES (toggle on)
→ Create bucket
```

### 1e. Get your keys
```
Supabase Dashboard → Settings → API
```
Copy these:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** (starts with `eyJ`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

---

## STEP 2 — Deploy on Vercel

### 2a. Push to GitHub
Push this code to a GitHub repo.

### 2b. Import on Vercel
Go to → https://vercel.com → New Project → Import your GitHub repo

### 2c. Add environment variables
In Vercel project → Settings → Environment Variables → add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kgqxukyytpvmblypuaxw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_MGWDvr-TOZtMp8tWERdk-Q_2pIMPd65` |

### 2d. Deploy
Click Deploy. Done.

---

## STEP 3 — How to Add Tests (THE RIGHT WAY)

### Method A — Upload to Supabase Storage ✅ RECOMMENDED
This does NOT use Vercel bandwidth at all.

1. Go to **Supabase Dashboard → Storage → tests bucket**
2. Create folders: `BITSAT/`, `JEE/`, etc.
3. Upload your `.json` test files into those folders
4. Done — tests appear automatically in TestZyro

**Example folder structure in Supabase Storage:**
```
tests/
  BITSAT/
    bitsat_paper_1.json
    bitsat_paper_2.json
    bitsat_paper_3.json
  JEE/
    jee_main_jan_2026.json
```

### Method B — Static in public/ folder (small tests only, NO images)
Only use this if your test JSON has NO images (pure text questions).
Put files in `public/tests/BITSAT/` and redeploy to Vercel.

### Method C — Generate from ZIP (Admin page)
Go to `/admin` on your site → BITSAT ZIP tab → Upload BITSAT zip → Download JSON.
Then upload that JSON to Supabase Storage (Method A).

---

## STEP 4 — First Login

1. Go to your Vercel URL → click **Log In** in the navbar
2. Click **Sign Up** tab
3. Enter email + password (no email verification needed)
4. You're in immediately

---

## STEP 5 — Analytics

After giving tests, go to `/analytics` to see:
- Your scores across all tests
- Subject-wise breakdown (Physics, Chemistry, Maths, English)
- Test-wise table with correct/wrong/not attempted
- Filter by All / Last 3 / Last 5 / Last 10 tests

---

## Test JSON Format

```json
{
  "title": "BITSAT Paper 1 2025",
  "subject": "BITSAT",
  "dur": 180,
  "mCor": 3,
  "mNeg": 1,
  "questions": [
    {
      "subject": "Physics",
      "type": "MCQ",
      "text": "A body of mass 5 kg is moving with velocity 10 m/s. Its kinetic energy is:",
      "opts": ["250 J", "500 J", "125 J", "1000 J"],
      "ans": "A"
    },
    {
      "subject": "Maths",
      "type": "INTEGER",
      "text": "Find the value of x if 2x + 5 = 15",
      "ans": "5"
    }
  ]
}
```

For image questions, store images as base64 in the `images` array:
```json
{
  "subject": "Physics",
  "type": "MCQ",
  "text": "",
  "images": ["<base64 string>"],
  "opts": ["A", "B", "C", "D"],
  "ans": "B"
}
```

---

## Pages

| URL | What it does |
|-----|-------------|
| `/` | Test library — browse and start tests |
| `/login` | Sign up / Log in |
| `/analytics` | Your performance analytics (Quizrr-style) |
| `/analyser` | Upload a result JSON file for detailed review |
| `/bookmarks` | Saved questions in notebooks |
| `/solutions` | PDF answer keys browser |
| `/admin` | Upload BITSAT ZIP files, manage tests |

---

## Works on
- **Vercel** (recommended) — free hobby plan is enough
- **Render** — build: `yarn install; yarn build`, start: `yarn start`
- **Railway** — auto-detects Next.js
- **Fly.io** — needs Dockerfile

---

## Local Development

```bash
# Install
npm install

# Create .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://kgqxukyytpvmblypuaxw.supabase.co" > .env.local
echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_MGWDvr-TOZtMp8tWERdk-Q_2pIMPd65" >> .env.local

# Run
npm run dev
# Open http://localhost:3000
```
