import { useState, useEffect } from 'react'
import Head from 'next/head'
import { getSupabase, isSupabaseReady } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!isSupabaseReady()) return
    getSupabase().auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = '/'
    })
  }, [])

  const submit = async () => {
    setErr(''); setLoading(true)
    if (!email.trim() || !pass.trim()) { setErr('Fill in all fields'); setLoading(false); return }
    if (!isSupabaseReady()) { setErr('DB not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to Vercel environment variables'); setLoading(false); return }
    const sb = getSupabase()
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass })
        if (error) throw error
        window.location.href = '/'
      } else {
        if (pass.length < 6) throw new Error('Password must be at least 6 characters')
        // Signup with email_confirm disabled in Supabase dashboard
        const { error } = await sb.auth.signUp({
          email: email.trim(),
          password: pass,
          options: {
            data: { full_name: name.trim() || email.split('@')[0] },
            emailRedirectTo: undefined // no email redirect
          }
        })
        if (error) throw error
        // Auto sign in after signup (works when email confirm is OFF in Supabase)
        const { error: sinError } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass })
        if (!sinError) { window.location.href = '/'; return }
        setErr('Account created! You can now log in.')
        setMode('login')
      }
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>{mode === 'login' ? 'Log In' : 'Sign Up'} — Karle</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#0a0e1a;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .wrap{width:100%;max-width:400px}
        .logo-row{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:32px}
        .lm{width:44px;height:44px;background:#6366f1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;color:white}
        .lt{font-weight:800;font-size:1.3rem;color:white}.lt span{color:#10b981}
        .card{background:#141927;border:1px solid #1e293b;border-radius:18px;padding:32px}
        .tabs{display:flex;gap:0;margin-bottom:24px;background:#0a0e1a;border-radius:10px;padding:4px}
        .tab{flex:1;padding:9px;border-radius:7px;text-align:center;font-size:.85rem;font-weight:600;cursor:pointer;color:#64748b;transition:all .15s;border:none;background:transparent;font-family:'Inter',sans-serif}
        .tab.on{background:#6366f1;color:white}
        .field{margin-bottom:14px}
        label{display:block;font-size:.7rem;font-weight:700;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px}
        input{width:100%;background:#0d1220;border:1.5px solid #1e293b;border-radius:10px;padding:12px 14px;color:white;font-family:'Inter',sans-serif;font-size:.9rem;outline:none;transition:border-color .15s}
        input:focus{border-color:#6366f1}
        input::placeholder{color:#334155}
        .btn{width:100%;background:#6366f1;color:white;border:none;padding:13px;border-radius:10px;font-family:'Inter',sans-serif;font-weight:700;font-size:.92rem;cursor:pointer;margin-top:4px;transition:all .15s}
        .btn:hover{background:#5254cc}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .err{background:rgba(239,68,68,.1);border:1px solid #ef4444;color:#ef9a9a;padding:10px 14px;border-radius:8px;font-size:.8rem;margin-bottom:16px;line-height:1.5}
        .back{text-align:center;margin-top:18px}
        .back a{color:#64748b;font-size:.8rem;text-decoration:none}
        .back a:hover{color:#94a3b8}
        .notice{background:rgba(99,102,241,.1);border:1px solid #6366f1;color:#a5b4fc;padding:10px 14px;border-radius:8px;font-size:.76rem;margin-bottom:16px;line-height:1.6}
      `}</style>
      <div className="wrap">
        <div className="logo-row">
          <div className="lm">K</div>
          <span className="lt">Kar<span>le</span></span>
        </div>
        <div className="card">
          <div className="tabs">
            <button className={`tab${mode==='login'?' on':''}`} onClick={()=>{setMode('login');setErr('')}}>Log In</button>
            <button className={`tab${mode==='signup'?' on':''}`} onClick={()=>{setMode('signup');setErr('')}}>Sign Up</button>
          </div>
          {mode==='signup' && (
            <div className="notice">
              ℹ️ Make sure email confirmation is <strong>disabled</strong> in Supabase Dashboard → Authentication → Settings → Email confirmations: OFF
            </div>
          )}
          {err && <div className="err">{err}</div>}
          {mode==='signup' && (
            <div className="field">
              <label>Your Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name (optional)"/>
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoCapitalize="none" autoCorrect="off"/>
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Min 6 characters" onKeyDown={e=>e.key==='Enter'&&submit()}/>
          </div>
          <button className="btn" onClick={submit} disabled={loading}>
            {loading ? 'Please wait…' : mode==='login' ? 'Log In' : 'Create Account'}
          </button>
        </div>
        <div className="back"><a href="/">← Back to Library</a></div>
      </div>
    </>
  )
}
