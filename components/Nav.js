import { useState, useEffect } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { href:'/', label:'Library', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  { href:'/analytics', label:'Analytics', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { href:'/analyser', label:'Analyser', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
  { href:'/solutions', label:'Solutions', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { href:'/bookmarks', label:'Bookmarks', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
  { href:'/admin', label:'Admin', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/></svg> },
]

export default function Nav({ active, extraLinks }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    // Always dark theme — force it
    document.documentElement.setAttribute('data-theme','dark')
    try { localStorage.setItem('tz_dark_mode','dark') } catch(e){}
  }, [])

  return (
    <>
      <style>{`
        header.tz-nav{background:#141927;padding:0 20px;display:flex;align-items:center;height:56px;gap:8px;border-bottom:1px solid #2d3748;position:sticky;top:0;z-index:100;font-family:'Inter',sans-serif}
        .tz-logo{display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0}
        .tz-lm{width:34px;height:34px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.82rem;color:white}
        .tz-lt{font-weight:800;font-size:1.05rem;color:white;letter-spacing:-.3px}
        .tz-lt span{color:#10b981}
        .tz-nav-links{display:flex;align-items:center;gap:2px;flex:1;overflow-x:auto;scrollbar-width:none}
        .tz-nav-links::-webkit-scrollbar{display:none}
        .tz-nb{padding:6px 10px;border-radius:7px;font-weight:500;font-size:.76rem;color:rgba(255,255,255,.55);transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0;border:none;background:transparent;cursor:pointer;font-family:'Inter',sans-serif}
        .tz-nb:hover{color:rgba(255,255,255,.9);background:rgba(255,255,255,.08)}
        .tz-nb.on{background:rgba(99,102,241,.2);color:white;font-weight:600}
      `}</style>
      <header className="tz-nav">
        <Link href="/" className="tz-logo">
          <img src="/logo.svg" width="32" height="32" style={{borderRadius:8}} alt="Karle"/>
          <span className="tz-lt">Kar<span>le</span></span>
        </Link>
        <nav className="tz-nav-links">
          {NAV_LINKS.map(({href,label,svg})=>(
            <Link key={href} href={href} className={`tz-nb${active===label?' on':''}`}>{svg}{label}</Link>
          ))}
          {extraLinks&&extraLinks.map(({label,onClick,isActive,svg})=>(
            <button key={label} onClick={onClick} className={`tz-nb${isActive?' on':''}`}>{svg}{label}</button>
          ))}
        </nav>
        <LoginBtn/>
      </header>
    </>
  )
}

function LoginBtn() {
  const [user, setUser] = useState(null)
  useEffect(()=>{
    try {
      const { getSupabase, isSupabaseReady } = require('../lib/supabase')
      if (!isSupabaseReady()) return
      getSupabase().auth.getSession().then(({data})=>{ if(data.session) setUser(data.session.user) })
    }catch(e){}
  },[])
  const logout = async () => {
    try {
      const { getSupabase } = require('../lib/supabase')
      await getSupabase().auth.signOut()
      // Clear local data so it doesn't bleed into the next login
      localStorage.removeItem('tz_attempts_v1')
      localStorage.removeItem('tz_saved_v3')
      localStorage.removeItem('tz_resume_v2')
      setUser(null)
      window.location.reload()
    }catch(e){}
  }
  const style = {padding:'6px 14px',borderRadius:20,fontFamily:"'Inter',sans-serif",fontSize:'.76rem',fontWeight:700,cursor:'pointer',flexShrink:0,display:'inline-flex',alignItems:'center',gap:5,textDecoration:'none',border:'none'}
  if (user) return (
    <button onClick={logout} style={{...style,background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.7)'}}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </button>
  )
  return (
    <a href="/login" style={{...style,background:'#6366f1',color:'white'}}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
      Log In
    </a>
  )
}
