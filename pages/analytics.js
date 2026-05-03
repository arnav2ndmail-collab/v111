import { useState, useEffect } from 'react'
import Head from 'next/head'
import { getSupabase, isSupabaseReady } from '../lib/supabase'

const SUBJ_ORDER_KNOWN = ['Physics','Chemistry','Maths','Biology','English & LR','Aptitude','Reasoning','General']
const SUBJECTS_BASE = ['Overall','Physics','Chemistry','Maths','Biology','English & LR']
const SC = {
  Overall:       { c:'#6366f1', ic:'✓'  },
  Physics:       { c:'#10b981', ic:'⚛'  },
  Chemistry:     { c:'#f97316', ic:'🧪' },
  Maths:         { c:'#06b6d4', ic:'∑'  },
  'English & LR':{ c:'#8b5cf6', ic:'A'  },
}
const pct = (a,b) => b ? Math.round(a/b*100) : 0
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) } catch(e){return ''} }

const ANALYSIS_ITEMS = [
  { label:'Performance', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> },
  { label:'Timeline',    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { label:'Leaderboard', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg> },
]

export default function Analytics() {
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [attempts, setAttempts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [section, setSection]     = useState('Performance')
  const [filterN, setFilterN]     = useState(0)
  const [activeSubj, setActiveSubj] = useState('Overall')
  const [showPct, setShowPct]     = useState(true)
  // Folder filter
  const [activeFolder, setActiveFolder] = useState('All')
  const [folderOpen, setFolderOpen]     = useState(false)
  // Leaderboard
  const [lbTest, setLbTest]       = useState(null)
  const [lbData, setLbData]       = useState(null)
  const [lbLoading, setLbLoading] = useState(false)

  useEffect(() => {
    if (!isSupabaseReady()) { setLoading(false); return }
    const sb = getSupabase()
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { window.location.href = '/login'; return }
      setUser(data.session.user)
      setSession(data.session)
      try {
        const r = await fetch('/api/cloud-attempts', {
          headers: { Authorization: `Bearer ${data.session.access_token}` }
        })
        if (r.ok) {
          const rows = await r.json()
          setAttempts((rows||[]).map(a => ({
            ...a,
            test_title: a.testTitle || a.test_title,
            test_path: a.testPath || a.test_path,
            test_id: a.testId || a.test_id,
            max_score: a.maxScore || a.max_score,
            marks_correct: a.marksCorrect || a.marks_correct || 3,
            marks_wrong: a.marksWrong || a.marks_wrong || 1,
            subj_stats: a.subjStats || a.subj_stats || {},
            taken_at: a.date || a.taken_at,
          })))
        }
      } catch(e) { console.warn('Analytics load failed:', e.message) }
      setLoading(false)
    })
  }, [])

  const logout = async () => { await getSupabase().auth.signOut(); window.location.href = '/login' }

  // Derive folders from attempts
  const folders = ['All', ...Array.from(new Set(attempts.map(a => {
    const p = a.test_path || a.test_id || ''
    if (p.includes('__storage__')) {
      const parts = p.replace('__storage__','').split('/')
      return parts.length > 1 ? parts[0] : 'General'
    }
    const parts = p.split('/')
    return parts.length > 1 ? parts[0] : 'General'
  })))]

  const folderFiltered = activeFolder === 'All' ? attempts
    : attempts.filter(a => {
        const p = a.test_path || a.test_id || ''
        const folder = p.includes('__storage__')
          ? (p.replace('__storage__','').split('/')[0] || 'General')
          : (p.split('/')[0] || 'General')
        return folder === activeFolder
      })

  const filtered = filterN > 0 ? folderFiltered.slice(0, filterN) : folderFiltered

  const loadLeaderboard = async (attempt) => {
    if (!session) return
    setLbTest(attempt)
    setLbLoading(true)
    setLbData(null)
    try {
      const testId = attempt.test_id || attempt.testId
      const r = await fetch(`/api/leaderboard?testId=${encodeURIComponent(testId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (r.ok) setLbData(await r.json())
    } catch(e) { console.warn(e) }
    setLbLoading(false)
  }

  // Dynamic subject list from actual data
  const allSubjKeys = [...new Set(filtered.flatMap(a => Object.keys(a.subj_stats || {})))]
  const SUBJECTS = ['Overall', ...SUBJ_ORDER_KNOWN.filter(s=>allSubjKeys.includes(s)), ...allSubjKeys.filter(s=>!SUBJ_ORDER_KNOWN.includes(s))]

  // ── FIX: was missing "const stats =" ──────────────────────────────────────
  const stats = (() => {
    if (!filtered.length) return null
    const n = filtered.length
    const avg = f => Math.round(filtered.reduce((s,a) => s+f(a), 0) / n)
    const tot = a => a.correct + a.wrong + a.skipped + a.unattempted
    return {
      avgScore:    avg(a => pct(a.score, a.max_score)),
      avgCorrect:  avg(a => pct(a.correct, tot(a))),
      avgWrong:    avg(a => pct(a.wrong, tot(a))),
      avgNA:       avg(a => pct(a.unattempted, tot(a))),
      avgNotVis:   avg(a => pct(a.skipped, tot(a))),
      subjData: Object.fromEntries(allSubjKeys.map(s => {
        const rows = filtered.filter(a => a.subj_stats?.[s])
        if (!rows.length) return [s, null]
        const sn = rows.length
        const avg2 = f => Math.round(rows.reduce((sum,a) => sum+f(a.subj_stats[s]),0)/sn)
        const st = x => (x.cor||0)+(x.wrg||0)+(x.skp||0)+(x.un||0)
        return [s, {
          avgScore: avg2(x => pct((x.cor||0)*3-(x.wrg||0), st(x)*3)),
          correct:  avg2(x => pct(x.cor||0, st(x))),
          wrong:    avg2(x => pct(x.wrg||0, st(x))),
        }]
      }))
    }
  })()

  return (
    <>
      <Head>
        <title>Analytics — Karle</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',-apple-system,sans-serif;background:#0a0e1a;color:#fff;line-height:1.6;overflow-x:hidden}
        ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#141927}::-webkit-scrollbar-thumb{background:#1a2234;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#2d3748}

        /* LEFT ICON SIDEBAR — fixed, 90px wide */
        .sidebar{position:fixed;left:0;top:0;width:90px;height:100vh;background:#141927;border-right:1px solid #2d3748;display:flex;flex-direction:column;align-items:center;padding:24px 0;z-index:100}
        .sb-logo{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;margin-bottom:8px;font-size:20px;font-weight:700;color:white;text-decoration:none}
        .sb-logo-txt{font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:32px}
        .nav-item{width:64px;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;border-radius:12px;margin-bottom:8px;transition:all .2s;position:relative;text-decoration:none;color:#94a3b8;border:none;background:none;font-family:'Inter',sans-serif}
        .nav-item:hover{background:#1e293b}
        .nav-item.active{background:#1a2234}
        .nav-item.active::before{content:'';position:absolute;left:-18px;width:3px;height:32px;background:#6366f1;border-radius:0 2px 2px 0}
        .nav-item svg{width:24px;height:24px;stroke:#94a3b8}
        .nav-item.active svg{stroke:#fff}
        .nav-label{font-size:11px;color:#94a3b8;font-weight:500}
        .nav-item.active .nav-label{color:#fff}
        .theme-toggle{margin-top:auto;margin-bottom:16px}
        /* Series selector button at bottom of sidebar */
        .series-btn{width:64px;height:80px;background:#10b981;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px;border:2px solid #10b981;margin-bottom:24px;color:white}
        .series-btn svg{width:28px;height:28px;fill:white}
        .series-btn-lbl{font-size:9px;font-weight:700;text-align:center;line-height:1.2}

        /* MAIN — pushed right of sidebar */
        .main-content{margin-left:90px;padding:32px;min-height:100vh}
        .layout{display:flex;gap:32px}

        /* LEFT PANEL — fixed width, proper spacing */
        .left-panel{width:420px;flex-shrink:0;padding-right:8px}
        .pack-selector{background:#141927;border:1px solid #6366f1;border-radius:12px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;cursor:pointer;transition:all .2s}
        .pack-selector:hover{background:#1a2234}
        .pack-label{display:flex;align-items:center;gap:12px;color:#fff;font-weight:600;font-size:15px}
        .pack-label svg{width:20px;height:20px;stroke:#fff}
        .pack-selector svg{width:20px;height:20px;stroke:#94a3b8}
        .pack-title{font-size:28px;font-weight:700;margin-bottom:8px;line-height:1.3}
        .pack-subtitle{font-size:20px;font-weight:600;color:#94a3b8}
        .analysis-menu{display:flex;flex-direction:column;gap:8px;margin-top:32px}
        .analysis-item{background:#141927;border:1px solid #2d3748;border-radius:12px;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all .2s}
        .analysis-item:hover{background:#1a2234;border-color:#6366f1}
        .analysis-item.active{background:#1a2234;border-color:#6366f1}
        .analysis-item-content{display:flex;align-items:center;gap:16px}
        .analysis-item svg.analysis-icon{width:20px;height:20px;stroke:#94a3b8}
        .analysis-item.active svg.analysis-icon{stroke:#6366f1}
        .analysis-label{font-size:15px;font-weight:600;color:#fff}
        .analysis-item svg.chevron{width:16px;height:16px;stroke:#64748b}

        /* RIGHT PANEL — fixed */
        .right-panel{position:fixed;left:570px;top:0;right:0;bottom:0;background:#0a0e1a;overflow-y:auto;padding:32px}
        @media(max-width:1400px){.right-panel{left:480px}}

        /* Content header */
        .content-header{margin-bottom:24px}
        .content-title{font-size:36px;font-weight:700;margin-bottom:24px}
        .filter-tabs{display:flex;gap:12px;margin-bottom:32px;flex-wrap:wrap}
        .filter-tab{padding:10px 20px;border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;background:#141927;border:1px solid #2d3748;color:#94a3b8;font-family:'Inter',sans-serif}
        .filter-tab.active{background:#6366f1;border-color:#6366f1;color:white}
        .filter-tab:hover:not(.active){background:#1a2234}

        /* Performance card */
        .performance-card{background:#141927;border-radius:16px;padding:32px;margin-bottom:32px}
        .section-title{font-size:24px;font-weight:700;margin-bottom:24px}
        .summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:24px;margin-top:24px}
        .summary-item{text-align:center}
        .summary-label{font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
        .summary-value{font-size:32px;font-weight:700}
        .summary-bar{height:6px;background:#1a2234;border-radius:3px;margin-top:12px;overflow:hidden}
        .summary-bar-fill{height:100%;border-radius:3px;transition:width .6s ease}

        /* Subject grid */
        .subject-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px}
        .subject-card{background:#1a2234;border-radius:12px;padding:20px;border:1px solid #2d3748}
        .subject-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
        .subject-name{font-size:14px;font-weight:600}
        .sc-stat{margin-bottom:10px}
        .sc-lbl{font-size:12px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px}
        .sc-val{font-size:24px;font-weight:700}

        /* Section header + toggle */
        .section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
        .toggle-switch{display:flex;align-items:center;gap:12px;font-size:14px;color:#94a3b8}
        .switch{position:relative;width:44px;height:24px;background:#1a2234;border-radius:12px;cursor:pointer;transition:all .3s;flex-shrink:0}
        .switch.active{background:#6366f1}
        .switch-handle{position:absolute;top:3px;left:3px;width:18px;height:18px;background:white;border-radius:50%;transition:all .3s}
        .switch.active .switch-handle{transform:translateX(20px)}

        /* Subject tabs (underline style) */
        .subject-tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:2px solid #2d3748}
        .subject-tab{padding:14px 24px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .2s;display:flex;align-items:center;gap:8px;color:#94a3b8;background:none;border-top:none;border-left:none;border-right:none;font-family:'Inter',sans-serif}
        .subject-tab:hover{color:#fff}
        .subject-tab.active{color:#fff;border-bottom-color:#6366f1}
        .subject-icon{font-size:16px}

        /* Test table */
        .test-table{width:100%;background:#141927;border-radius:16px;overflow:hidden}
        .table-header{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;gap:16px;padding:18px 24px;background:#1a2234;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8}
        .table-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;gap:16px;padding:20px 24px;border-bottom:1px solid #2d3748;transition:all .2s;cursor:pointer}
        .table-row:hover{background:#1e293b}
        .table-row:last-child{border-bottom:none}
        .test-name{font-weight:600;font-size:14px}
        .test-date{font-size:12px;color:#64748b;margin-top:4px}
        .stat-value{font-size:20px;font-weight:700;display:flex;align-items:center;gap:6px}
        .stat-max{font-size:12px;font-weight:500;color:#64748b}
        .stat-bar{height:48px;width:4px;border-radius:2px;margin-left:4px}

        /* Animate */
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .animate-in{animation:fadeInUp .5s ease forwards}

        /* States */
        .state{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;color:#64748b;text-align:center}
        .state h2{color:white;font-size:1.3rem;font-weight:700}
        .state p{font-size:.9rem;max-width:360px;line-height:1.7}
        .state a,.state-btn{background:#6366f1;color:white;border:none;padding:12px 28px;border-radius:10px;font-family:'Inter',sans-serif;font-weight:700;font-size:.9rem;cursor:pointer;text-decoration:none;margin-top:8px;display:inline-block}
        .spin{width:36px;height:36px;border:3px solid #1a2234;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media(max-width:1200px){
          .summary-grid{grid-template-columns:repeat(3,1fr)}
          .subject-grid{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>

      {/* LEFT ICON SIDEBAR */}
      <div className="sidebar">
        <a href="/" className="sb-logo">K</a>
        <div className="sb-logo-txt">Karle</div>

        {[
          { href:'/', label:'Home', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { href:'/', label:'All Tests', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
          { href:'/analytics', label:'Analysis', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>, active:true },
          { href:'/bookmarks', label:'Notebooks', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
        ].map((l,i)=>(
          <a key={i} href={l.href} className={`nav-item${l.active?' active':''}`}>
            {l.icon}<span className="nav-label">{l.label}</span>
          </a>
        ))}

        <button className="nav-item theme-toggle" onClick={logout} title="Logout" style={{marginTop:'auto',marginBottom:16}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span className="nav-label">Logout</span>
        </button>

        {/* Folder selector — clickable list */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.6rem',fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'1px',marginBottom:8,paddingLeft:4}}>My Tests</div>
          {folders.map(f=>(
            <div key={f} onClick={()=>setActiveFolder(f)}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:3,
                background:activeFolder===f?'rgba(99,102,241,.15)':'transparent',
                border:activeFolder===f?'1px solid rgba(99,102,241,.3)':'1px solid transparent',
                transition:'all .15s'}}
              onMouseEnter={e=>{if(activeFolder!==f)e.currentTarget.style.background='rgba(255,255,255,.04)'}}
              onMouseLeave={e=>{if(activeFolder!==f)e.currentTarget.style.background='transparent'}}
            >
              <span style={{fontSize:'.85rem'}}>{f==='All'?'📂':'📁'}</span>
              <span style={{fontSize:'.78rem',fontWeight:600,color:activeFolder===f?'#818cf8':'#94a3b8',flex:1}}>{f==='All'?'All Tests':f}</span>
              {activeFolder===f&&<svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        {loading ? (
          <div className="state"><div className="spin"/><p>Loading your analytics…</p></div>
        ) : !isSupabaseReady() ? (
          <div className="state"><h2>Database not configured</h2><p>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel environment variables.</p><a href="/">← Back to Library</a></div>
        ) : !user ? (
          <div className="state"><h2>Not logged in</h2><a href="/login">Log In</a></div>
        ) : (
          <div className="layout">
            {/* LEFT PANEL */}
            <div className="left-panel">
              <div className="pack-selector">
              </div>

              <div className="pack-title">{activeFolder === 'All' ? 'All Tests' : activeFolder}</div>
              <div className="pack-subtitle">{filtered.length} test{filtered.length!==1?'s':''} attempted</div>

              <div className="analysis-menu">
                {ANALYSIS_ITEMS.map(({ label, icon }) => (
                  <div key={label} className={`analysis-item${section===label?' active':''}`} onClick={()=>setSection(label)}>
                    <div className="analysis-item-content">
                      <svg className="analysis-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon.props.children}</svg>
                      <span className="analysis-label">{label}</span>
                    </div>
                    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="right-panel">
              <div className="content-header">
                <h1 className="content-title">{section}</h1>
                <div className="filter-tabs">
                  {[[0,'All Tests'],[3,'Last 3 Tests'],[5,'Last 5 Tests'],[10,'Last 10 Tests']].map(([n,l])=>(
                    <button key={n} className={`filter-tab${filterN===n?' active':''}`} onClick={()=>setFilterN(n)}>{l}</button>
                  ))}
                </div>
              </div>

              {!attempts.length ? (
                <div className="state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  <h2>No tests completed yet</h2>
                  <p>Go give some tests first, then come back here to see your full analytics.</p>
                  <a href="/">Start a Test →</a>
                </div>
              ) : section === 'Performance' && stats ? (
                <>
                  {/* Summary */}
                  <div className="performance-card animate-in">
                    <h3 className="section-title">Summary</h3>
                    <div className="summary-grid">
                      {[
                        {l:'Average Score',    v:stats.avgScore,   c:'#f59e0b'},
                        {l:'Attempted Correct',v:stats.avgCorrect, c:'#10b981'},
                        {l:'Attempted Wrong',  v:stats.avgWrong,   c:'#ef4444'},
                        {l:'Not Attempted',    v:stats.avgNA,      c:'#6366f1'},
                        {l:'Not Visited Qs',   v:stats.avgNotVis,  c:'#64748b'},
                      ].map(({l,v,c})=>(
                        <div key={l} className="summary-item">
                          <div className="summary-label">{l}</div>
                          <div className="summary-value" style={{color:c}}>{v}%</div>
                          <div className="summary-bar">
                            <div className="summary-bar-fill" style={{width:v+'%',background:`linear-gradient(90deg,${c},${c}99)`}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subject performance */}
                  <div className="performance-card animate-in" style={{animationDelay:'.1s'}}>
                    <div className="subject-grid">
                      {SUBJECTS.map(s => {
                        const d = s==='Overall' ? {avgScore:stats.avgScore,correct:stats.avgCorrect,wrong:stats.avgWrong} : stats.subjData[s]
                        return (
                          <div key={s} className="subject-card">
                            <div className="subject-header">
                              <span style={{color:SC[s]?.c||'#94a3b8',fontSize:18}}>{SC[s]?.ic||'•'}</span>
                              <span className="subject-name">{s}</span>
                            </div>
                            {d ? <>
                              <div className="sc-stat"><div className="sc-lbl">Avg Score</div><div className="sc-val" style={{color:'#f59e0b'}}>{d.avgScore}%</div></div>
                              <div className="sc-stat"><div className="sc-lbl">Correct</div><div className="sc-val" style={{color:'#10b981'}}>{d.correct}%</div></div>
                              <div className="sc-stat"><div className="sc-lbl">Wrong</div><div className="sc-val" style={{color:'#ef4444'}}>{d.wrong}%</div></div>
                            </> : <div style={{color:'#334155',fontSize:'.8rem',marginTop:8}}>Give a test first</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Test-wise breakdown */}
                  <div className="animate-in" style={{animationDelay:'.2s'}}>
                    <div className="section-header">
                      <h3 className="section-title">Test-wise Breakdown</h3>
                      <div className="toggle-switch">
                        <span>% Show Percentage</span>
                        <div className={`switch${showPct?' active':''}`} onClick={()=>setShowPct(p=>!p)}>
                          <div className="switch-handle"/>
                        </div>
                      </div>
                    </div>

                    <div className="subject-tabs">
                      {SUBJECTS.map(s=>(
                        <button key={s} className={`subject-tab${activeSubj===s?' active':''}`} onClick={()=>setActiveSubj(s)}>
                          <span className="subject-icon">{SC[s]?.ic||'•'}</span>
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>

                    <div className="test-table">
                      <div className="table-header">
                        <div>Test Title</div>
                        <div>Total Score</div>
                        <div>Attempted Correct</div>
                        <div>Attempted Wrong</div>
                        <div>Not Attempted</div>
                        <div>Not Visited Qs</div>
                      </div>
                      {filtered.map((a,i) => {
                        const isOverall = activeSubj === 'Overall'
                        const ss = !isOverall ? a.subj_stats?.[activeSubj] : null
                        const tot = isOverall
                          ? a.correct+a.wrong+a.skipped+a.unattempted
                          : ss ? (ss.cor||0)+(ss.wrg||0)+(ss.skp||0)+(ss.un||0) : 0
                        const scr = isOverall ? a.score : ss ? (ss.cor||0)*a.marks_correct-(ss.wrg||0)*a.marks_wrong : 0
                        const maxScr = isOverall ? a.max_score : ss ? tot*(a.marks_correct||3) : 0
                        const cor = isOverall ? a.correct : ss?.cor||0
                        const wrg = isOverall ? a.wrong : ss?.wrg||0
                        const na = isOverall ? a.unattempted : ss?.un||0
                        const skp = isOverall ? a.skipped : ss?.skp||0
                        const sp = pct(scr, maxScr)
                        const cp = pct(cor, tot), wp=pct(wrg, tot)
                        const np = pct(na, tot), vp=pct(skp, tot)
                        const maxH = 120
                        if (!isOverall && !ss) return null
                        const openAnalyser = () => {
                          const tp = a.test_path || a.test_id
                          const tiny = {
                            testTitle:a.test_title, subject:a.subject, date:a.taken_at,
                            score:a.score, maxScore:a.max_score, accuracy:a.accuracy,
                            correct:a.correct, wrong:a.wrong, skipped:a.skipped, unattempted:a.unattempted,
                            duration:a.duration, marksCorrect:a.marks_correct, marksWrong:a.marks_wrong,
                            subjStats:a.subj_stats, answers:a.answers
                          }
                          try { sessionStorage.setItem('tz_analyse', JSON.stringify(tiny)) } catch(e) {}
                          window.location.href = '/analyser?src=auto&tp=' + encodeURIComponent(tp||'')
                        }
                        const deleteRow = async () => {
                          if (!confirm('Delete this attempt?')) return
                          setAttempts(prev => prev.filter((_,j) => j!==i))
                          try {
                            const sb = (await import('../lib/supabase')).getSupabase()
                            const { data: { session } } = await sb.auth.getSession()
                            if (session?.access_token) {
                              await fetch('/api/cloud-attempts', {
                                method: 'DELETE',
                                headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
                                body: JSON.stringify({ id: a.id })
                              })
                            }
                          } catch(e) { console.warn('Delete failed:', e.message) }
                        }
                        return (
                          <div key={i} className="table-row" style={{cursor:'pointer'}} onClick={openAnalyser}>
                            <div>
                              <div className="test-name">{a.test_title}</div>
                              <div className="test-date">{fmtDate(a.taken_at)}</div>
                              <button onClick={e=>{e.stopPropagation();deleteRow()}} style={{marginTop:4,background:'transparent',border:'1px solid #ef5350',color:'#ef5350',borderRadius:6,padding:'2px 8px',fontSize:'.65rem',cursor:'pointer'}}>🗑 Delete</button>
                            </div>
                            {[
                              [sp,  scr,  maxScr, '#f59e0b'],
                              [cp,  cor,   tot,    '#10b981'],
                              [wp,  wrg,   tot,    '#ef4444'],
                              [np,  na,    tot,    '#6366f1'],
                              [vp,  skp,   tot,    '#64748b'],
                            ].map(([p,v,m,c],j)=>(
                              <div key={j} className="stat-value" style={{color:c}}>
                                {showPct ? <>{p}<span className="stat-max">%</span></> : <>{v}<span className="stat-max">/ {m}</span></>}
                                <div className="stat-bar" style={{height:Math.max(2,p/100*maxH)+'px',background:`linear-gradient(to bottom,${c},transparent)`}}/>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : section==='Timeline' ? (
                <>
                  {/* Leaderboard modal */}
                  {lbTest && (
                    <div onClick={()=>setLbTest(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                      <div onClick={e=>e.stopPropagation()} style={{background:'#141927',border:'1px solid #2d3748',borderRadius:18,width:'100%',maxWidth:520,maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.6)'}}>
                        <div style={{padding:'16px 20px',borderBottom:'1px solid #2d3748',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:'.92rem',color:'#e2e8f0'}}>🏆 Leaderboard</div>
                            <div style={{fontSize:'.7rem',color:'#64748b',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lbTest.test_title}</div>
                          </div>
                          <button onClick={()=>setLbTest(null)} style={{background:'transparent',border:'1px solid #2d3748',color:'#64748b',width:30,height:30,borderRadius:7,cursor:'pointer',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                        </div>
                        {!lbLoading && lbData?.myRank && (
                          <div style={{padding:'12px 20px',borderBottom:'1px solid #2d3748',background:'rgba(99,102,241,.08)',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
                            <div style={{fontSize:'1.6rem',fontWeight:900,color:'#6366f1',minWidth:44,textAlign:'center'}}>#{lbData.myRank.rank}</div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,color:'#e2e8f0',fontSize:'.85rem'}}>You · {lbData.myRank.name}</div>
                              <div style={{fontSize:'.68rem',color:'#94a3b8'}}>Score {lbData.myRank.score}/{lbData.myRank.maxScore} · {lbData.myRank.accuracy}% accuracy</div>
                            </div>
                            <div style={{fontSize:'.68rem',color:'#475569',flexShrink:0}}>{lbData.total} took this test</div>
                          </div>
                        )}
                        <div style={{overflowY:'auto',flex:1,padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
                          {lbLoading ? (
                            <div className="state"><div className="spin"/><p>Loading…</p></div>
                          ) : !lbData?.leaderboard?.length ? (
                            <div className="state"><p>No data yet</p></div>
                          ) : lbData.leaderboard.map((row,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,border:`1.5px solid ${row.isYou?'#6366f1':'#1e293b'}`,background:row.isYou?'rgba(99,102,241,.08)':'transparent'}}>
                              <div style={{width:30,height:30,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.78rem',flexShrink:0,background:i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#cd7c3a':'#1e293b',color:i<3?'#0a0e1a':'#64748b'}}>
                                {i===0?'🥇':i===1?'🥈':i===2?'🥉':row.rank}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:600,fontSize:'.83rem',color:row.isYou?'#818cf8':'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {row.name}{row.isYou?' (You)':''}
                                </div>
                                <div style={{fontSize:'.62rem',color:'#475569'}}>✓ {row.correct} · ✗ {row.wrong}</div>
                              </div>
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <div style={{fontWeight:800,fontSize:'.88rem',color:'#f59e0b'}}>{row.score}</div>
                                <div style={{fontSize:'.6rem',color:'#64748b'}}>{row.accuracy}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline bars */}
                  <div className="performance-card animate-in">
                    <h3 className="section-title">Score Timeline</h3>
                    <div style={{overflowX:'auto',paddingBottom:8}}>
                      <div style={{display:'flex',alignItems:'flex-end',gap:10,minHeight:180,padding:'12px 4px',borderBottom:'1px solid #2d3748',minWidth:filtered.length*62+'px'}}>
                        {filtered.slice().reverse().map((a,i)=>{
                          const sp=pct(a.score,a.max_score)
                          const col=sp>=60?'#10b981':sp>=40?'#f59e0b':'#ef4444'
                          return(
                            <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:52,flex:'0 0 52px'}}>
                              <div style={{fontSize:'.65rem',color:col,fontWeight:800}}>{sp}%</div>
                              <div style={{width:36,background:col,borderRadius:'6px 6px 0 0',height:Math.max(6,sp*1.5)+'px',opacity:.9,transition:'height .4s'}}/>
                              <div style={{fontSize:'.55rem',color:'#64748b',textAlign:'center',lineHeight:1.3,maxWidth:52,wordBreak:'break-word',marginTop:4}}>{a.test_title.length>12?a.test_title.slice(0,12)+'…':a.test_title}</div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{display:'flex',gap:14,marginTop:12,flexWrap:'wrap'}}>
                        {[['#10b981','≥60% Good'],['#f59e0b','40–60% Average'],['#ef4444','<40% Needs Work']].map(([col,l])=>(
                          <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:'.72rem',color:'#64748b'}}>
                            <div style={{width:10,height:10,borderRadius:3,background:col}}/>{l}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard tiles */}
                  <div className="performance-card animate-in" style={{marginTop:16}}>
                    <h3 className="section-title">🏆 Leaderboard</h3>
                    <p style={{fontSize:'.75rem',color:'#64748b',marginBottom:14}}>Click a test to see how you ranked among all users</p>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
                      {filtered.slice().reverse().map((a,i)=>{
                        const sp=pct(a.score,a.max_score)
                        const col=sp>=60?'#10b981':sp>=40?'#f59e0b':'#ef4444'
                        return(
                          <div key={i} style={{background:'#0d1220',border:'1px solid #1e293b',borderRadius:12,padding:14,display:'flex',flexDirection:'column',gap:8}}>
                            <div style={{fontSize:'.75rem',fontWeight:700,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.test_title}</div>
                            <div style={{fontSize:'.62rem',color:'#475569'}}>{fmtDate(a.taken_at)}</div>
                            <div style={{display:'flex',gap:10,alignItems:'center'}}>
                              <div style={{fontWeight:800,fontSize:'1.1rem',color:col}}>{sp}%</div>
                              <div style={{fontSize:'.65rem',color:'#64748b'}}>{a.score}/{a.max_score} pts</div>
                            </div>
                            <button onClick={()=>loadLeaderboard(a)} style={{marginTop:'auto',width:'100%',background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.3)',color:'#818cf8',padding:'7px 0',borderRadius:8,fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}
                              onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,.25)'}
                              onMouseLeave={e=>e.currentTarget.style.background='rgba(99,102,241,.1)'}
                            >🏆 View Leaderboard</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : section==='Leaderboard' ? (
                <>
                  {lbTest && (
                    <div onClick={()=>setLbTest(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                      <div onClick={e=>e.stopPropagation()} style={{background:'#141927',border:'1px solid #2d3748',borderRadius:18,width:'100%',maxWidth:520,maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.6)'}}>
                        <div style={{padding:'16px 20px',borderBottom:'1px solid #2d3748',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:'.92rem',color:'#e2e8f0'}}>🏆 Leaderboard</div>
                            <div style={{fontSize:'.7rem',color:'#64748b',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lbTest.test_title}</div>
                          </div>
                          <button onClick={()=>setLbTest(null)} style={{background:'transparent',border:'1px solid #2d3748',color:'#64748b',width:30,height:30,borderRadius:7,cursor:'pointer',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                        </div>
                        {!lbLoading && lbData?.myRank && (
                          <div style={{padding:'12px 20px',borderBottom:'1px solid #2d3748',background:'rgba(99,102,241,.08)',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
                            <div style={{fontSize:'1.6rem',fontWeight:900,color:'#6366f1',minWidth:44,textAlign:'center'}}>#{lbData.myRank.rank}</div>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,color:'#e2e8f0',fontSize:'.85rem'}}>You · {lbData.myRank.name}</div>
                              <div style={{fontSize:'.68rem',color:'#94a3b8'}}>Score {lbData.myRank.score}/{lbData.myRank.maxScore} · {lbData.myRank.accuracy}% accuracy</div>
                            </div>
                            <div style={{fontSize:'.68rem',color:'#475569',flexShrink:0}}>{lbData.total} participants</div>
                          </div>
                        )}
                        <div style={{overflowY:'auto',flex:1,padding:'12px 16px',display:'flex',flexDirection:'column',gap:6}}>
                          {lbLoading ? <div className="state"><div className="spin"/><p>Loading…</p></div>
                          : !lbData?.leaderboard?.length ? <div className="state"><p>No entries yet</p></div>
                          : lbData.leaderboard.map((row,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,border:`1.5px solid ${row.isYou?'#6366f1':'#1e293b'}`,background:row.isYou?'rgba(99,102,241,.08)':'transparent'}}>
                              <div style={{width:30,height:30,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.78rem',flexShrink:0,background:i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#cd7c3a':'#1e293b',color:i<3?'#0a0e1a':'#64748b'}}>
                                {i===0?'🥇':i===1?'🥈':i===2?'🥉':row.rank}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:600,fontSize:'.83rem',color:row.isYou?'#818cf8':'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.name}{row.isYou?' (You)':''}</div>
                                <div style={{fontSize:'.62rem',color:'#475569'}}>✓ {row.correct} · ✗ {row.wrong}</div>
                              </div>
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <div style={{fontWeight:800,fontSize:'.88rem',color:'#f59e0b'}}>{row.score}</div>
                                <div style={{fontSize:'.6rem',color:'#64748b'}}>{row.accuracy}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="performance-card animate-in">
                    <h3 className="section-title">🏆 Leaderboard</h3>
                    <p style={{fontSize:'.75rem',color:'#64748b',marginBottom:16}}>Select a test to see your rank among all users</p>
                    {!filtered.length ? (
                      <div className="state"><p>No tests attempted yet</p><a href="/">Start a Test →</a></div>
                    ) : (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
                        {filtered.slice().reverse().map((a,i)=>{
                          const sp=pct(a.score,a.max_score)
                          const col=sp>=60?'#10b981':sp>=40?'#f59e0b':'#ef4444'
                          return(
                            <div key={i} style={{background:'#0d1220',border:'1px solid #1e293b',borderRadius:12,padding:14,display:'flex',flexDirection:'column',gap:8}}>
                              <div style={{fontSize:'.75rem',fontWeight:700,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.test_title}</div>
                              <div style={{fontSize:'.62rem',color:'#475569'}}>{fmtDate(a.taken_at)}</div>
                              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                                <div style={{fontWeight:800,fontSize:'1.1rem',color:col}}>{sp}%</div>
                                <div style={{fontSize:'.65rem',color:'#64748b'}}>{a.score}/{a.max_score} pts</div>
                              </div>
                              <button onClick={()=>loadLeaderboard(a)} style={{marginTop:'auto',width:'100%',background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.3)',color:'#818cf8',padding:'7px 0',borderRadius:8,fontSize:'.72rem',fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}
                                onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,.25)'}
                                onMouseLeave={e=>e.currentTarget.style.background='rgba(99,102,241,.1)'}
                              >🏆 View Leaderboard</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="state">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  <h2>{section}</h2>
                  <p>This section is coming soon. Keep giving tests!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}