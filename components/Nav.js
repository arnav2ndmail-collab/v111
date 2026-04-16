import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Nav({ active, extraLinks }) {
  const [dark, setDark] = useState(false)
  useEffect(()=>{ 
    try { setDark(localStorage.getItem('tz_dark_mode')==='dark') } catch(e){}
  },[])
  const toggleDark = () => {
    const next = !dark; setDark(next)
    try {
      localStorage.setItem('tz_dark_mode', next?'dark':'light')
      document.documentElement.setAttribute('data-theme', next?'dark':'')
    } catch(e){}
  }

  const links = [
    { href:'/', label:'Library', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
    { href:'/analyser', label:'Analyser', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { href:'/analytics', label:'My Analytics', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
    { href:'/solutions', label:'Solutions', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { href:'/bookmarks', label:'Bookmarks', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
    { href:'/migrate', label:'Migrate', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> },
    { href:'/admin', label:'Admin', svg:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/></svg> },
  ]

  return (
    <header style={{background:'#1a237e',padding:'0 20px',display:'flex',alignItems:'center',height:56,gap:8,boxShadow:'0 2px 12px rgba(26,35,126,.4)',position:'sticky',top:0,zIndex:100,fontFamily:"'Inter',sans-serif"}}>
      <Link href="/" style={{display:'flex',alignItems:'center',gap:8,textDecoration:'none',flexShrink:0}}>
        <div style={{width:34,height:34,background:'#fdd835',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:'.82rem',color:'#1a237e',fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-.5px'}}>TZ</div>
        <span style={{fontWeight:800,fontSize:'1.05rem',letterSpacing:'-.3px',color:'white'}}>Test<span style={{color:'#fdd835'}}>Zyro</span></span>
      </Link>
      <nav style={{display:'flex',alignItems:'center',gap:2,flex:1,overflowX:'auto',msOverflowStyle:'none',scrollbarWidth:'none'}}>
        {links.map(({href,label,svg})=>(
          <Link key={href} href={href} style={{
            padding:'6px 10px',borderRadius:6,fontWeight:active===label?700:500,
            fontSize:'.78rem',color:active===label?'white':'rgba(255,255,255,.75)',
            background:active===label?'rgba(255,255,255,.2)':'transparent',
            textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5,
            whiteSpace:'nowrap',flexShrink:0,transition:'all .15s',fontFamily:"'Inter',sans-serif"
          }}>{svg}{label}</Link>
        ))}
        {extraLinks&&extraLinks.map(({label,onClick,isActive,svg})=>(
          <button key={label} onClick={onClick} style={{
            padding:'6px 10px',borderRadius:6,fontWeight:isActive?700:500,
            fontSize:'.78rem',color:isActive?'white':'rgba(255,255,255,.75)',
            background:isActive?'rgba(255,255,255,.2)':'transparent',
            border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5,
            whiteSpace:'nowrap',flexShrink:0,fontFamily:"'Inter',sans-serif",transition:'all .15s'
          }}>{svg}{label}</button>
        ))}
      </nav>
      <LoginBtn/>
      <button onClick={toggleDark} title={dark?'Light':'Dark'} style={{background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',color:'white',width:34,height:34,borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        {dark
          ?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
          :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        }
      </button>
    </header>
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
      setUser(null)
      window.location.reload()
    }catch(e){}
  }
  if (user) return (
    <button onClick={logout} title="Logout" style={{background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',color:'rgba(255,255,255,.85)',padding:'6px 12px',borderRadius:8,cursor:'pointer',font:"600 .76rem 'Inter',sans-serif",flexShrink:0,display:'flex',alignItems:'center',gap:5}}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </button>
  )
  return (
    <a href="/login" style={{background:'rgba(99,102,241,.8)',color:'white',padding:'6px 14px',borderRadius:8,textDecoration:'none',font:"700 .78rem 'Inter',sans-serif",flexShrink:0}}>
      Log In
    </a>
  )

}
