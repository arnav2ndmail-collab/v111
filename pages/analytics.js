import { useState, useEffect } from 'react'
import Head from 'next/head'
import { getSupabase, isSupabaseReady } from '../lib/supabase'

const SUBJECTS = ['Overall','Physics','Chemistry','Maths','English & LR']
const SC = { Overall:{c:'#6366f1',ic:'✓'}, Physics:{c:'#10b981',ic:'⚛'}, Chemistry:{c:'#f97316',ic:'🧪'}, Maths:{c:'#06b6d4',ic:'∑'}, 'English & LR':{c:'#8b5cf6',ic:'A'} }
const pct = (a,b) => b ? Math.round(a/b*100) : 0
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) } catch(e){return ''} }
const fmtTime = s => { if(!s)return '--'; const m=Math.floor(s/60); return m>0?`${m}m ${s%60}s`:`${s}s` }

export default function Analytics() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('Performance')
  const [filterN, setFilterN] = useState(0)
  const [activeSubj, setActiveSubj] = useState('Overall')
  const [showPct, setShowPct] = useState(true)

  useEffect(() => {
    if (!isSupabaseReady()) { setLoading(false); return }
    const sb = getSupabase()
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { window.location.href = '/login'; return }
      const u = data.session.user
      setUser(u)
      // Load profile
      const { data: prof } = await sb.from('profiles').select('*').eq('id', u.id).single()
      setProfile(prof)
      // Load attempts newest first
      const { data: rows } = await sb.from('test_attempts').select('*').eq('user_id', u.id).order('taken_at', { ascending: false })
      setAttempts(rows || [])
      setLoading(false)
    })
  }, [])

  const logout = async () => {
    await getSupabase().auth.signOut()
    window.location.href = '/login'
  }

  const filtered = filterN > 0 ? attempts.slice(0, filterN) : attempts

  const stats = (() => {
    if (!filtered.length) return null
    const n = filtered.length
    const avg = f => Math.round(filtered.reduce((s,a)=>s+f(a),0)/n)
    const avgScore = avg(a => pct(a.score, a.max_score))
    const avgCorrect = avg(a => pct(a.correct, a.correct+a.wrong+a.skipped+a.unattempted))
    const avgWrong = avg(a => pct(a.wrong, a.correct+a.wrong+a.skipped+a.unattempted))
    const avgNA = avg(a => pct(a.unattempted, a.correct+a.wrong+a.skipped+a.unattempted))
    const avgNotVisited = avg(a => pct(a.skipped, a.correct+a.wrong+a.skipped+a.unattempted))
    const subjData = {}
    SUBJECTS.filter(s=>s!=='Overall').forEach(s => {
      const rows = filtered.filter(a => a.subj_stats?.[s])
      if (!rows.length) return
      const sc = rows.map(a => a.subj_stats[s])
      const sn = sc.length
      subjData[s] = {
        avgScore: Math.round(sc.reduce((sum,x)=>sum+pct((x.cor||0)*3-(x.wrg||0),((x.cor||0)+(x.wrg||0)+(x.skp||0)+(x.un||0))*3),0)/sn),
        correct: Math.round(sc.reduce((sum,x)=>sum+pct(x.cor||0,(x.cor||0)+(x.wrg||0)+(x.skp||0)+(x.un||0)),0)/sn),
        wrong: Math.round(sc.reduce((sum,x)=>sum+pct(x.wrg||0,(x.cor||0)+(x.wrg||0)+(x.skp||0)+(x.un||0)),0)/sn),
      }
    })
    return { avgScore, avgCorrect, avgWrong, avgNA, avgNotVisited, subjData }
  })()

  const SECTIONS = ['Performance','Timeline','Qs Type Breakup','Quality of Attempts','Time Analysis','Difficulty Analysis','Chapter Analysis']

  const SECTION_ICONS = {
    'Performance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
    'Timeline': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    'Qs Type Breakup': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    'Quality of Attempts': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
    'Time Analysis': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    'Difficulty Analysis': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    'Chapter Analysis': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  }

  return (
    <>
      <Head>
        <title>Analytics — TestZyro</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>

      <div className="shell">
        {/* Icon sidebar */}
        <div className="icon-sb">
          <a href="/" className="is-logo">TZ</a>
          <div className="is-nav">
            {[
              {href:'/', ic:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
              {href:'/analyser', ic:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>},
              {href:'/analytics', ic:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, active:true},
              {href:'/bookmarks', ic:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>},
            ].map((l,i)=><a key={i} href={l.href} className={`is-btn${l.active?' on':''}`}>{l.ic}</a>)}
          </div>
          <button className="is-btn is-logout" onClick={logout} title="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>

        {/* Analysis sidebar */}
        <div className="analysis-sb">
          <div className="asb-top">
            <div className="asb-title">BITSAT Series</div>
            <div className="asb-sub">Full Test Series</div>
          </div>
          <div className="asb-menu">
            {SECTIONS.map(s => (
              <button key={s} className={`asb-item${section===s?' on':''}`} onClick={()=>setSection(s)}>
                <div className="asb-item-left">
                  <span className="asb-ic">{SECTION_ICONS[s]}</span>
                  <span>{s}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="main">
          {loading ? (
            <div className="state-center"><div className="spinner"/><span>Loading your data…</span></div>
          ) : !isSupabaseReady() ? (
            <div className="state-center">
              <h2>Database not configured</h2>
              <p>Add Supabase env vars in Vercel settings</p>
              <a href="/" className="state-btn">← Back</a>
            </div>
          ) : !attempts.length ? (
            <div className="state-center">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <h2>No tests given yet</h2>
              <p>Complete a test to see your analytics here.</p>
              <a href="/" className="state-btn">Start a Test →</a>
            </div>
          ) : (
            <>
              <div className="main-hdr">
                <h1 className="main-title">{section}</h1>
                <div className="filter-row">
                  {[[0,'All Tests'],[3,'Last 3 Tests'],[5,'Last 5 Tests'],[10,'Last 10 Tests']].map(([n,l])=>(
                    <button key={n} className={`ftab${filterN===n?' on':''}`} onClick={()=>setFilterN(n)}>{l}</button>
                  ))}
                </div>
              </div>

              {section==='Performance' && stats && <>
                {/* Summary */}
                <div className="card">
                  <h3 className="card-title">Summary</h3>
                  <div className="summary-grid">
                    {[
                      {l:'Average Score',v:stats.avgScore,c:'#f59e0b'},
                      {l:'Attempted Correct',v:stats.avgCorrect,c:'#10b981'},
                      {l:'Attempted Wrong',v:stats.avgWrong,c:'#ef4444'},
                      {l:'Not Attempted',v:stats.avgNA,c:'#6366f1'},
                      {l:'Skipped Qs',v:stats.avgNotVisited,c:'#64748b'},
                    ].map(({l,v,c})=>(
                      <div key={l} className="si">
                        <div className="si-lbl">{l}</div>
                        <div className="si-val" style={{color:c}}>{v}%</div>
                        <div className="si-track"><div className="si-fill" style={{width:v+'%',background:c}}/></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subject cards */}
                <div className="card">
                  <div className="subj-cards">
                    {SUBJECTS.map(s => {
                      const d = s==='Overall' ? {avgScore:stats.avgScore,correct:stats.avgCorrect,wrong:stats.avgWrong} : stats.subjData[s]
                      return (
                        <div key={s} className="sc">
                          <div className="sc-hdr">
                            <span style={{color:SC[s].c,fontSize:18}}>{SC[s].ic}</span>
                            <span className="sc-name">{s}</span>
                          </div>
                          {d ? <>
                            <div className="sc-row"><div className="sc-lbl">Avg Score</div><div className="sc-val" style={{color:'#f59e0b'}}>{d.avgScore}%</div></div>
                            <div className="sc-row"><div className="sc-lbl">Correct</div><div className="sc-val" style={{color:'#10b981'}}>{d.correct}%</div></div>
                            <div className="sc-row"><div className="sc-lbl">Wrong</div><div className="sc-val" style={{color:'#ef4444'}}>{d.wrong}%</div></div>
                          </> : <div style={{color:'#334155',fontSize:'.76rem',marginTop:8}}>No data yet</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Test-wise breakdown */}
                <div className="card">
                  <div className="card-hdr-row">
                    <h3 className="card-title" style={{margin:0}}>Test-wise Breakdown</h3>
                    <div className="toggle-row">
                      <span style={{fontSize:'.76rem',color:'#64748b'}}>Show %</span>
                      <div className={`tog${showPct?' on':''}`} onClick={()=>setShowPct(p=>!p)}><div className="tog-k"/></div>
                    </div>
                  </div>
                  <div className="stabs">
                    {SUBJECTS.map(s=>(
                      <button key={s} className={`stab${activeSubj===s?' on':''}`}
                        style={activeSubj===s?{borderColor:SC[s].c,color:SC[s].c,background:'rgba(255,255,255,.03)'}:{}}
                        onClick={()=>setActiveSubj(s)}>
                        <span style={{color:SC[s].c}}>{SC[s].ic}</span> {s}
                      </button>
                    ))}
                  </div>
                  <div className="tbl">
                    <div className="tbl-hdr">
                      <div>Test Title</div>
                      <div style={{color:'#f59e0b'}}>Total Score</div>
                      <div style={{color:'#10b981'}}>Attempted Correct</div>
                      <div style={{color:'#ef4444'}}>Attempted Wrong</div>
                      <div style={{color:'#6366f1'}}>Not Attempted</div>
                      <div style={{color:'#64748b'}}>Not Visited</div>
                    </div>
                    {filtered.map((a,i)=>{
                      const tot = a.correct+a.wrong+a.skipped+a.unattempted
                      const sp = pct(a.score,a.max_score)
                      const cp = pct(a.correct,tot), wp=pct(a.wrong,tot), np=pct(a.unattempted,tot), skp=pct(a.skipped,tot)
                      return (
                        <div key={i} className="tbl-row">
                          <div>
                            <div className="tbl-name">{a.test_title}</div>
                            <div className="tbl-date">{fmtDate(a.taken_at)}</div>
                          </div>
                          {[[sp,a.score,a.max_score,'#f59e0b'],[cp,a.correct,tot,'#10b981'],[wp,a.wrong,tot,'#ef4444'],[np,a.unattempted,tot,'#6366f1'],[skp,a.skipped,tot,'#64748b']].map(([p,v,m,c],j)=>(
                            <div key={j} className="tbl-val" style={{color:c}}>
                              <span>{showPct ? p+'%' : `${v}/${m}`}</span>
                              <div className="tbl-bar" style={{height:Math.max(3,p*0.6)+'px',background:c}}/>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>}

              {section!=='Performance' && (
                <div className="state-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  <h2 style={{color:'white'}}>{section}</h2>
                  <p>Give more tests to unlock this analysis</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0e1a;color:#f1f5f9;font-family:'Inter',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}
.shell{display:flex;height:100vh;overflow:hidden}
/* Icon sidebar */
.icon-sb{width:72px;flex-shrink:0;background:#141927;border-right:1px solid #1e293b;display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px}
.is-logo{width:38px;height:38px;background:#6366f1;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.82rem;color:white;text-decoration:none;margin-bottom:16px;flex-shrink:0}
.is-nav{display:flex;flex-direction:column;gap:4px;flex:1;align-items:center}
.is-btn{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#475569;text-decoration:none;transition:all .15s;border:none;background:none;cursor:pointer}
.is-btn:hover{background:#1e293b;color:#94a3b8}
.is-btn.on{background:#1e293b;color:#6366f1}
.is-logout:hover{color:#ef4444}
/* Analysis sidebar */
.analysis-sb{width:230px;flex-shrink:0;background:#0d1220;border-right:1px solid #1e293b;display:flex;flex-direction:column;overflow:hidden}
.asb-top{padding:20px 16px 14px;border-bottom:1px solid #1e293b}
.asb-title{font-weight:700;font-size:.92rem;color:white;margin-bottom:2px}
.asb-sub{font-size:.72rem;color:#475569}
.asb-menu{padding:8px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;flex:1}
.asb-item{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-radius:8px;cursor:pointer;color:#64748b;font-size:.8rem;font-weight:500;transition:all .15s;border:none;background:transparent;font-family:'Inter',sans-serif;width:100%;text-align:left}
.asb-item:hover{background:#141927;color:#94a3b8}
.asb-item.on{background:#1e293b;color:#6366f1}
.asb-item-left{display:flex;align-items:center;gap:8px}
.asb-ic{display:flex;align-items:center;opacity:.7}
/* Main */
.main{flex:1;overflow-y:auto;padding:24px;background:#0a0e1a}
.main-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.main-title{font-size:1.35rem;font-weight:800;color:white;letter-spacing:-.3px}
.filter-row{display:flex;gap:6px;flex-wrap:wrap}
.ftab{padding:6px 14px;border-radius:20px;background:transparent;border:1.5px solid #1e293b;color:#475569;font-family:'Inter',sans-serif;font-size:.76rem;font-weight:600;cursor:pointer;transition:all .15s}
.ftab:hover{border-color:#6366f1;color:#6366f1}
.ftab.on{background:#6366f1;border-color:#6366f1;color:white}
/* Cards */
.card{background:#141927;border:1px solid #1e293b;border-radius:14px;padding:20px;margin-bottom:16px}
.card-title{font-size:.88rem;font-weight:700;color:white;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px}
.card-hdr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
/* Summary */
.summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.si{background:#0d1220;border:1px solid #1e293b;border-radius:10px;padding:14px}
.si-lbl{font-size:.7rem;color:#64748b;margin-bottom:6px;font-weight:500}
.si-val{font-size:1.6rem;font-weight:800;font-family:'JetBrains Mono','Roboto Mono',monospace;margin-bottom:8px;line-height:1}
.si-track{height:3px;background:#1e293b;border-radius:99px;overflow:hidden}
.si-fill{height:100%;border-radius:99px;transition:width .6s}
/* Subject cards */
.subj-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.sc{background:#0d1220;border:1px solid #1e293b;border-radius:12px;padding:14px}
.sc-hdr{display:flex;align-items:center;gap:7px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #1e293b}
.sc-name{font-size:.8rem;font-weight:700;color:white}
.sc-row{margin-bottom:7px}
.sc-lbl{font-size:.62rem;color:#475569;margin-bottom:2px;font-weight:500}
.sc-val{font-size:1.3rem;font-weight:800;font-family:'JetBrains Mono','Roboto Mono',monospace}
/* Subject tabs */
.stabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;margin-top:12px}
.stab{padding:5px 13px;border-radius:20px;background:transparent;border:1.5px solid #1e293b;color:#475569;font-family:'Inter',sans-serif;font-size:.75rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s}
.stab:hover{border-color:#6366f1;color:#6366f1}
/* Table */
.tbl{border-radius:10px;overflow:hidden;border:1px solid #1e293b}
.tbl-hdr{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;padding:10px 14px;background:#0d1220;font-size:.65rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px}
.tbl-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;padding:12px 14px;border-top:1px solid #1e293b;align-items:end;transition:background .12s;cursor:default}
.tbl-row:hover{background:#141927}
.tbl-name{font-size:.82rem;font-weight:600;color:white;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.tbl-date{font-size:.67rem;color:#475569}
.tbl-val{font-weight:700;font-size:.84rem;display:flex;flex-direction:column;align-items:flex-start;gap:3px;font-family:'JetBrains Mono','Roboto Mono',monospace}
.tbl-bar{width:6px;border-radius:99px;min-height:3px;transition:height .3s}
/* Toggle */
.toggle-row{display:flex;align-items:center;gap:8px}
.tog{width:34px;height:18px;background:#1e293b;border-radius:9px;cursor:pointer;position:relative;transition:background .2s}
.tog.on{background:#6366f1}
.tog-k{width:14px;height:14px;background:white;border-radius:50%;position:absolute;top:2px;left:2px;transition:left .2s}
.tog.on .tog-k{left:18px}
/* States */
.state-center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:14px;color:#475569;text-align:center}
.state-center h2{color:white;font-size:1.1rem;font-weight:700}
.state-center p{font-size:.82rem;max-width:320px;line-height:1.6}
.state-btn{background:#6366f1;color:white;border:none;padding:10px 22px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.84rem;cursor:pointer;text-decoration:none;margin-top:4px}
.spinner{width:32px;height:32px;border:3px solid #1e293b;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`
