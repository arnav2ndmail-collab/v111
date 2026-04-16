# Quizrr Analytics Platform 📊

A full-stack JEE/NEET test analytics platform with user authentication, test series management, and performance tracking.

## ✨ Features

- ✅ **User Authentication** - Secure login/register system
- ✅ **Multiple Test Series** - Switch between JEE, NEET, BITSAT tests
- ✅ **Performance Analytics** - Detailed test-wise breakdown
- ✅ **Subject-wise Stats** - Physics, Chemistry, Mathematics tracking
- ✅ **Real-time Updates** - Live data from database
- ✅ **Responsive Design** - Works on all devices

## 🗄️ Database: Supabase (Free PostgreSQL)

**Why Supabase?**
- ✅ FREE tier with 500MB database
- ✅ Built-in authentication
- ✅ Real-time capabilities
- ✅ Auto-generated REST APIs
- ✅ PostgreSQL (industry standard)

## 📁 Project Structure

```
quizrr-analytics/
├── public/
│   └── index.html          # Frontend application
├── server.js               # Express backend server
├── database-schema.sql     # Database setup script
├── package.json            # Dependencies
├── .env.example            # Environment variables template
├── vercel.json             # Vercel deployment config
└── README.md              # This file
```

## 🚀 Quick Setup (Step by Step)

### Step 1: Create Supabase Database (FREE)

1. Go to https://supabase.com
2. Click "Start your project" → Sign up with GitHub
3. Create a new project:
   - **Project name**: quizrr-analytics
   - **Database password**: (choose a strong password)
   - **Region**: Choose closest to you
4. Wait 2-3 minutes for project to be ready

### Step 2: Setup Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Copy ENTIRE content from `database-schema.sql` file
4. Paste and click "Run" (bottom right)
5. You should see "Success. No rows returned"

### Step 3: Get Database Credentials

1. In Supabase, go to **Settings** (left sidebar) → **API**
2. Copy these 3 values:
   - **Project URL** (looks like: https://xxxxx.supabase.co)
   - **anon public key** (starts with: eyJhbGciOiJI...)
   - **service_role key** (starts with: eyJhbGciOiJI...)

### Step 4: Local Development Setup

1. **Install Node.js** (if not installed):
   - Download from https://nodejs.org (v18 or higher)
   - Verify: `node --version`

2. **Clone/Download project files**

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Create .env file** (copy from .env.example):
   ```bash
   cp .env.example .env
   ```

5. **Edit .env file** with your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_KEY=your_service_key_here
   JWT_SECRET=my_super_secret_key_12345
   PORT=3000
   ```

6. **Start the server**:
   ```bash
   npm start
   ```

7. **Open browser**: http://localhost:3000

## 🌐 Deploy to Production (FREE)

### Option 1: Deploy to Vercel (Recommended)

**Backend Deployment:**

1. Create a `vercel.json` file (already included)

2. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Set environment variables in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add all variables from .env file

6. Get your production URL (looks like: https://your-app.vercel.app)

7. Update `API_URL` in `public/index.html`:
   ```javascript
   const API_URL = 'https://your-app.vercel.app/api';
   ```

8. Redeploy:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy to Render.com (FREE)

1. Push code to GitHub

2. Go to https://render.com → Sign up

3. Click "New" → "Web Service"

4. Connect your GitHub repository

5. Configure:
   - **Name**: quizrr-analytics
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

6. Add Environment Variables (same as .env)

7. Click "Create Web Service"

8. Copy your production URL

9. Update `API_URL` in frontend

### Option 3: Deploy to Railway.app (FREE)

1. Go to https://railway.app → Sign up with GitHub

2. Click "New Project" → "Deploy from GitHub repo"

3. Select your repository

4. Add environment variables

5. Deploy automatically

6. Copy your production URL

## 📤 How to Upload Test Data

### Method 1: Via API (Recommended for bulk upload)

Create a script `upload-tests.js`:

```javascript
const fs = require('fs');

// Your test data
const testData = {
    test_series_id: 'your-series-id-from-database',
    name: 'JEE Main 2026 (23 Jan Shift 1)',
    test_date: '2026-01-23',
    total_questions: 75,
    total_marks: 300,
    duration_minutes: 180
};

// Upload via API
fetch('http://localhost:3000/api/tests', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
});
```

### Method 2: Direct Database Insert

1. Go to Supabase → Table Editor
2. Select `tests` table
3. Click "Insert" → "Insert row"
4. Fill in test details
5. Save

### Method 3: CSV Import (Bulk Upload)

1. Prepare CSV file with columns:
   ```
   name,test_date,total_questions,total_marks,duration_minutes
   JEE Main 2026 Test 1,2026-01-23,75,300,180
   JEE Main 2026 Test 2,2026-01-24,75,300,180
   ```

2. In Supabase → Table Editor → `tests`
3. Click "Import data" → Upload CSV

## 📝 How Students Upload Their Test Attempts

### Via API Endpoint:

```javascript
// Student submits test
const attemptData = {
    total_score: 187,
    attempted_correct: 48,
    attempted_wrong: 5,
    not_attempted: 22,
    not_visited: 0,
    accuracy: 90.57,
    percentile: 99.3,
    physics_score: 85,
    chemistry_score: 62,
    mathematics_score: 40,
    time_taken_minutes: 165
};

fetch('http://localhost:3000/api/tests/TEST_ID/submit', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer STUDENT_TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(attemptData)
});
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Test Series
- `GET /api/test-series` - Get all test series
- `GET /api/test-series/:id` - Get single test series
- `GET /api/test-series/:seriesId/tests` - Get tests in series

### User Attempts
- `GET /api/test-series/:seriesId/my-attempts` - Get user's attempts
- `POST /api/tests/:testId/submit` - Submit test attempt
- `GET /api/test-series/:seriesId/performance-summary` - Get summary

## 🎯 Next Steps

1. ✅ User authentication - DONE
2. ✅ Database integration - DONE
3. ✅ Multiple test series - DONE
4. ✅ Real user data - DONE
5. 🔄 Add test upload interface (Coming next)
6. 🔄 Add detailed analytics views
7. 🔄 Add export to PDF/CSV

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check your Supabase credentials in .env
- Make sure project is not paused (Supabase free tier pauses after 1 week inactivity)

### "CORS error"
- Update CORS settings in server.js
- Make sure API_URL matches your backend URL

### "Invalid token"
- Logout and login again
- Check JWT_SECRET is same in backend

## 📞 Support

For issues or questions:
1. Check database connection in Supabase
2. Check browser console for errors
3. Check server logs for backend errors

## 🎓 Built For

JEE/NEET/BITSAT aspirants who want to track their test performance and improve their scores.

---

**Made with ❤️ for students preparing for competitive exams**
