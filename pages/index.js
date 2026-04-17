import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Nav from '../components/Nav'
import { getSupabase, isSupabaseReady } from '../lib/supabase'

const pad = n => String(n).padStart(2,'0')
const fmt = s => `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`
const fmtDate = iso => { try { const d=new Date(iso); return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) } catch(e){return iso} }
const SAVED_KEY   = 'tz_saved_v3'
const RESUME_KEY  = 'tz_resume_v1'
const ATTEMPTS_KEY = 'tz_attempts_v1'

// ── EDIT THIS to update the "What's New" panel ────────────────────────────
const WHATS_NEW = [
  { date: '08 Apr 2025', text: '🎁 Bonus questions — unlocks after all main Qs answered' },
  { date: '08 Apr 2025', text: '⏸ Resume — close tab anytime, continue where you left off' },
  { date: '08 Apr 2025', text: '📊 Past Tests — analyse previous attempts directly' },
  { date: '07 Apr 2025', text: '📄 Solutions page — download answer key PDFs' },
]
// ─────────────────────────────────────────────────────────────────────────

const BITSAT_SUBJECTS = ['Physics','Chemistry','Maths','English & LR']
const SUBJECT_COLORS = {
  'Physics':      { bg:'#1a237e', light:'#e8eaf6', dot:'#3949ab', label:'PHY' },
  'Chemistry':    { bg:'#1b5e20', light:'#e8f5e9', dot:'#388e3c', label:'CHEM' },
  'Maths':        { bg:'#b71c1c', light:'#ffebee', dot:'#c62828', label:'MATH' },
  'English & LR': { bg:'#4a148c', light:'#f3e5f5', dot:'#7b1fa2', label:'ENG'  },
}
function getSubjColor(subj) {
  return SUBJECT_COLORS[subj] || { bg:'#37474f', light:'#eceff1', dot:'#546e7a', label:'Q' }
}

// ── LEAN STORAGE: only save answers/progress, re-fetch test for images ───
// Resume: {testPath, ans, marked, visited, cur, elapsed, savedAt, cfg(no images)}
function saveResume(data) {
  try {
    const str = JSON.stringify(data)
    if (str && str.length > 10) localStorage.setItem(RESUME_KEY, str)
  } catch(e) {}
}
function loadResume() {
  try {
    const s = localStorage.getItem(RESUME_KEY)
    if (!s || s === 'null' || s === 'undefined' || s.length < 10) return null
    const d = JSON.parse(s)
    if (d?.cfg && d?.savedAt && Date.now()-d.savedAt < 6*60*60*1000) return d
    localStorage.removeItem(RESUME_KEY)
  } catch(e) { localStorage.removeItem(RESUME_KEY) }
  return null
}
function clearResume() {
  try { localStorage.removeItem(RESUME_KEY) } catch(e) {}
}
// Attempt: scores + answers only (no images) + testPath to re-fetch
function saveAttempt(attempt) {
  try {
    const prev = JSON.parse(localStorage.getItem(ATTEMPTS_KEY)||'[]')
    const updated = [attempt, ...prev.filter(a=>a.testId!==attempt.testId)].slice(0,30)
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(updated))
    return updated
  } catch(e) { return [] }
}

export default function TestZyro() {
  const [page, setPage]             = useState('library')
  const [tree, setTree]             = useState({ folders:{}, tests:[] })
  const [savedTests, setSavedTests] = useState([])
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [openFolders, setOpenFolders] = useState({})
  const [treeLoad, setTreeLoad]     = useState(true)
  const [cbtOn, setCbtOn]           = useState(false)
  const [Qs, setQs]                 = useState([])
  const [ans, setAns]               = useState([])
  const [marked, setMarked]         = useState([])
  const [visited, setVisited]       = useState([])
  const [cur, setCur]               = useState(0)
  const [secs, setSecs]             = useState(0)
  const [done, setDone]             = useState(false)
  const [reviewing, setReviewing]   = useState(false)
  const [cfg, setCfg]               = useState({})
  const [result, setResult]         = useState(null)
  const [activeNavSubj, setActiveNavSubj] = useState(null)
  const [uploadMsg, setUploadMsg]   = useState('')
  const [resumeData, setResumeData] = useState(null)
  const [cbtLoading, setCbtLoading] = useState(false)
  const [attempts, setAttempts]     = useState([])
  const [activeFolder, setActiveFolder] = useState(null)
  const [sbUser, setSbUser]         = useState(null) // logged-in Supabase user

  const timerRef  = useRef(null)
  const startRef  = useRef(null)
  const cbtAns    = useRef([])
  const cbtStateRef = useRef({})

  // Keep ref fresh every render
  useEffect(() => {
    cbtStateRef.current = { cbtOn, done, Qs, cfg, marked, visited, cur }
  })

  useEffect(() => {
    setSavedTests(JSON.parse(localStorage.getItem(SAVED_KEY)||'[]'))
    setAttempts(JSON.parse(localStorage.getItem(ATTEMPTS_KEY)||'[]'))
    // Check Supabase session
    if (isSupabaseReady()) {
      getSupabase().auth.getSession().then(({ data }) => {
        if (data.session) setSbUser(data.session.user)
      })
    }
    // Load resume
    try {
      const rd = loadResume()
      if (rd) setResumeData(rd)
      else clearResume()
    } catch(e) { clearResume() }
    loadTree()
  }, [])

  const loadTree = async () => {
    setTreeLoad(true)
    try {
      const r = await fetch('/api/tests'); const d = await r.json()
      setTree(d)
      const keys = Object.keys(d.folders||{})
      if (keys.length) setOpenFolders({ [keys[0]]: true })
    } catch(e) {}
    setTreeLoad(false)
  }

  const startFromTree = async (testPath) => {
    if (cbtLoading) return
    setCbtLoading(true)
    try {
      const r = await fetch(`/api/test/${testPath}`)
      const d = await r.json()
      if (!d.questions) throw new Error('bad file')
      doLaunch(d.questions, { title:d.title, dur:d.dur||180, mCor:d.mCor||3, mNeg:d.mNeg||1, id:d.id||testPath, testPath:testPath, subject:d.subject, pageImages:d.pageImages||null })
    } catch(e) { alert('Failed: '+e.message); setCbtLoading(false) }
  }

  const startFromSaved = (t) => {
    if (cbtLoading) return
    setCbtLoading(true)
    doLaunch(t.questions, { title:t.title, dur:t.dur||180, mCor:t.mCor||3, mNeg:t.mNeg||1, id:t.id, subject:t.subject })
  }

  const isBITSAT = (subj) => (subj||'').toUpperCase().includes('BITSAT')

  const doLaunch = (qs, c) => {
    const blankAns = new Array(qs.length).fill(null)
    setQs(qs); setCfg(c)
    setAns(blankAns); cbtAns.current = blankAns
    setMarked(new Array(qs.length).fill(false))
    setVisited(new Array(qs.length).fill(false))
    setCur(0); setDone(false); setReviewing(false); setResult(null)
    setSecs(c.dur*60)
    if (isBITSAT(c.subject||'')) {
      const firstSubj = qs.find(q=>q.subject)?.subject || BITSAT_SUBJECTS[0]
      setActiveNavSubj(firstSubj)
    } else { setActiveNavSubj(null) }
    setCbtOn(true)
    setCbtLoading(false)
    window.scrollTo(0,0)
    startRef.current = Date.now()
    clearInterval(timerRef.current)
    // Save tiny resume - testPath is the actual file path for re-fetching
    saveResume({
      testPath: c.testPath || c.id, cfg: c,
      ans: blankAns, marked: new Array(qs.length).fill(false),
      visited: new Array(qs.length).fill(false),
      cur: 0, elapsed: 0, savedAt: Date.now()
    })
  }

  // Timer
  useEffect(() => {
    if (!cbtOn || done) { clearInterval(timerRef.current); return }
    timerRef.current = setInterval(() => setSecs(s => {
      if (s<=1) { clearInterval(timerRef.current); doSubmit(true); return 0 }
      return s-1
    }), 1000)
    return () => clearInterval(timerRef.current)
  }, [cbtOn, done])

  // saveProgress — reads from ref, no stale closure
  const saveProgress = useCallback(() => {
    const s = cbtStateRef.current
    if (!s.cbtOn || s.done || !s.cfg?.id) return
    saveResume({
      testPath: s.cfg.testPath || s.cfg.id, cfg: s.cfg,
      ans: cbtAns.current,
      marked: s.marked, visited: s.visited, cur: s.cur,
      elapsed: Math.round((Date.now() - startRef.current) / 1000),
      savedAt: Date.now()
    })
  }, [])

  // Register auto-save once when CBT starts
  useEffect(() => {
    if (!cbtOn || done) return
    const interval = setInterval(saveProgress, 10000)
    window.addEventListener('beforeunload', saveProgress)
    return () => { clearInterval(interval); window.removeEventListener('beforeunload', saveProgress) }
  }, [cbtOn, done])

  const exitCBT = () => {
    if (!confirm('Exit? Progress saved — resume anytime.')) return
    clearInterval(timerRef.current)
    const s = cbtStateRef.current
    const saveData = {
      testPath: s.cfg.testPath || s.cfg.id, cfg: s.cfg,
      ans: cbtAns.current,
      marked: s.marked, visited: s.visited, cur: s.cur,
      elapsed: Math.round((Date.now() - startRef.current) / 1000),
      savedAt: Date.now()
    }
    saveResume(saveData)
    setResumeData(saveData)
    setCbtLoading(false)
    setCbtOn(false); setResult(null)
  }

  const resumeTest = async (rd) => {
    if (cbtLoading) return
    setCbtLoading(true)
    try {
      const testPath = rd.testPath || rd.cfg?.id
      if (!testPath) throw new Error('No test path saved')
      // Re-fetch test to get fresh questions + images
      const r = await fetch(`/api/test/${testPath}`)
      if (!r.ok) throw new Error(`Test not found (${r.status})`)
      const d = await r.json()
      if (!d.questions?.length) throw new Error('No questions in test file')
      const qs = d.questions
      if (rd.cfg && d.pageImages) rd.cfg.pageImages = d.pageImages

      setQs(qs); setCfg(rd.cfg)
      // Restore answers — if length mismatch use blank
      const restoredAns = (rd.ans?.length === qs.length) ? rd.ans : new Array(qs.length).fill(null)
      setAns(restoredAns); cbtAns.current = restoredAns
      setMarked((rd.marked?.length === qs.length) ? rd.marked : new Array(qs.length).fill(false))
      setVisited((rd.visited?.length === qs.length) ? rd.visited : new Array(qs.length).fill(false))
      setCur(rd.cur || 0)
      setDone(false); setReviewing(false); setResult(null)
      setSecs(Math.max(0, (rd.cfg.dur*60) - (rd.elapsed||0)))
      if (isBITSAT(rd.cfg.subject||'')) {
        setActiveNavSubj(qs[rd.cur||0]?.subject || BITSAT_SUBJECTS[0])
      } else { setActiveNavSubj(null) }
      setCbtOn(true)
      setCbtLoading(false)
      window.scrollTo(0,0)
      startRef.current = Date.now() - ((rd.elapsed||0)*1000)
      clearInterval(timerRef.current)
      setResumeData(null)
    } catch(e) {
      alert('Could not resume: ' + e.message)
      setCbtLoading(false)
    }
  }

  const discardResume = () => {
    clearResume()
    setResumeData(null)
  }

  const setAnswer = useCallback((val) => {
    setAns(prev => { const a=[...prev]; a[cur]=val; cbtAns.current=a; return a })
  }, [cur])

  const markVisited = useCallback((idx) => {
    setVisited(prev => { const v=[...prev]; v[idx]=true; return v })
  }, [])

  const saveAndNext = () => {
    markVisited(cur)
    setMarked(prev => { const m=[...prev]; m[cur]=false; return m })
    // Skip bonus if not unlocked
    const mIdxs = Qs.map((_,i)=>i).filter(i=>!Qs[i]?.isBonus)
    const bonusDone = mIdxs.every(i => cbtAns.current[i] !== null && cbtAns.current[i] !== undefined)
    let next = cur+1
    while (next < Qs.length && Qs[next]?.isBonus && !bonusDone) next++
    if (next < Qs.length) setCur(next)
  }

  const markForReview = () => {
    markVisited(cur)
    setMarked(prev => { const m=[...prev]; m[cur]=true; return m })
    if (!ans[cur] || ans[cur]==='skip') setAnswer('skip')
    const mIdxs = Qs.map((_,i)=>i).filter(i=>!Qs[i]?.isBonus)
    const bonusDone = mIdxs.every(i => cbtAns.current[i] !== null && cbtAns.current[i] !== undefined)
    let next = cur+1
    while (next < Qs.length && Qs[next]?.isBonus && !bonusDone) next++
    if (next < Qs.length) setCur(next)
  }

  const clearQ = () => {
    setAnswer(null)
    setMarked(prev => { const m=[...prev]; m[cur]=false; return m })
  }

  const goTo = (idx) => { markVisited(cur); setCur(idx) }

  const doSubmit = useCallback(async (auto=false) => {
    if (!auto && !confirm('Submit test? This cannot be undone.')) return
    clearInterval(timerRef.current)
    const finalAns = cbtAns.current
    const elapsed = Math.round((Date.now()-startRef.current)/1000)
    let cor=0,wrg=0,skp=0,un=0
    const subjStats = {}
    finalAns.forEach((a,i) => {
      const q=Qs[i]; const ak=(q?.ans||'').toString().trim(); const subj=q?.subject||'Other'
      if (!subjStats[subj]) subjStats[subj]={cor:0,wrg:0,skp:0,un:0}
      if (!a){un++;subjStats[subj].un++;return}
      if (a==='skip'){skp++;subjStats[subj].skp++;return}
      const parts=ak.split(/\s+or\s+/i).map(s=>s.trim().toUpperCase())
      if (parts.includes(a.toString().toUpperCase().trim())){cor++;subjStats[subj].cor++}
      else{wrg++;subjStats[subj].wrg++}
    })
    const score=cor*(cfg.mCor||3)-wrg*(cfg.mNeg||1)
    const max=Qs.length*(cfg.mCor||3)
    const res={cor,wrg,skp,un,score,max,elapsed,pct:Math.round(cor/Qs.length*100),answers:finalAns,subjStats}
    setResult(res); setDone(true)
    clearResume()
    setResumeData(null)
    // Save lean attempt — only answers + scores, NO images. testPath used to re-fetch later.
    const attempt = {
      id: Date.now()+'_'+Math.random().toString(36).slice(2,6),
      testId: cfg.id, testPath: cfg.testPath || cfg.id, testTitle: cfg.title, subject: cfg.subject,
      date: new Date().toISOString(),
      score: res.score, maxScore: res.max, accuracy: res.pct,
      correct: res.cor, wrong: res.wrg, skipped: res.skp, unattempted: res.un,
      duration: res.elapsed, marksCorrect: cfg.mCor, marksWrong: cfg.mNeg,
      subjStats: res.subjStats,
      // Store only answers per question (no images)
      questions: Qs.map((q,i)=>({
        qnum:q.qnum||i+1, subject:q.subject||'Other', type:q.type,
        text:q.text, opts:q.opts,
        correctAnswer:q.ans, yourAnswer:finalAns[i],
        result:!finalAns[i]?'unattempted':finalAns[i]==='skip'?'skipped':
          ((q.ans||'').toUpperCase().trim()===(finalAns[i]||'').toUpperCase().trim())?'correct':'wrong'
      }))
    }
    const updated = saveAttempt(attempt)
    setAttempts(updated)
    // Also save to Supabase if user is logged in
    if (isSupabaseReady() && sbUser) {
      try {
        const { data: { session } } = await getSupabase().auth.getSession()
        if (session) {
          fetch('/api/save-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+session.access_token },
            body: JSON.stringify({
              testId: cfg.id, testPath: cfg.testPath||cfg.id, testTitle: cfg.title,
              subject: cfg.subject, score: res.score, maxScore: res.max,
              correct: res.cor, wrong: res.wrg, skipped: res.skp, unattempted: res.un,
              accuracy: res.pct, duration: res.elapsed,
              marksCorrect: cfg.mCor, marksWrong: cfg.mNeg,
              subjStats: res.subjStats, answers: finalAns.map((a,i)=>({yourAnswer:a,correctAnswer:Qs[i]?.ans,result:!a?'unattempted':a==='skip'?'skipped':((Qs[i]?.ans||'').toUpperCase().trim()===(a||'').toUpperCase().trim())?'correct':'wrong'}))
            })
          }).catch(()=>{}) // silent fail
        }
      } catch(e) {}
    }
    // Increment global counter
    try {
      const g = parseInt(localStorage.getItem('tz_global_tests')||'0')
      localStorage.setItem('tz_global_tests', String(g+1))
      setGlobalTests(g+1)
    } catch(e) {}
  }, [Qs, cfg])

  const downloadOutputFile = (res) => {
    const data={
      testId:cfg.id,testTitle:cfg.title,subject:cfg.subject,
      date:new Date().toISOString(),score:res.score,maxScore:res.max,
      correct:res.cor,wrong:res.wrg,skipped:res.skp,unattempted:res.un,
      duration:res.elapsed,accuracy:res.pct,marksCorrect:cfg.mCor,marksWrong:cfg.mNeg,
      subjStats:res.subjStats,
      questions:Qs.map((q,i)=>({
        qnum:q.qnum||i+1,subject:q.subject||'Other',type:q.type,text:q.text,
        opts:q.opts,images:q.images||null,hasImage:q.hasImage||false,
        correctAnswer:q.ans,yourAnswer:res.answers[i],
        result:!res.answers[i]?'unattempted':res.answers[i]==='skip'?'skipped':
          ((q.ans||'').toUpperCase().trim()===(res.answers[i]||'').toUpperCase().trim())?'correct':'wrong'
      }))
    }
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url
    a.download=`${cfg.title||'test'}_result_${new Date().toISOString().slice(0,10)}.json`
    a.click();URL.revokeObjectURL(url)
  }

  const onJsonFiles = async (files) => {
    let ok=0,fail=0; const current=[...savedTests]
    for (const f of files) {
      try {
        const d=JSON.parse(await f.text())
        if (!Array.isArray(d.questions)) throw new Error('no questions')
        current.unshift({id:d.id||'json_'+Date.now()+'_'+ok,title:d.title||f.name.replace('.json',''),subject:d.subject||'Other',source:d.source||'',questions:d.questions,dur:d.dur||180,mCor:d.mCor||3,mNeg:d.mNeg||1,savedAt:Date.now()})
        ok++
      } catch{fail++}
    }
    setSavedTests(current)
    try{localStorage.setItem(SAVED_KEY,JSON.stringify(current))}catch(e){}
    setUploadMsg(`✅ Loaded ${ok} test(s)${fail?`, ${fail} failed`:''}`)
    setTimeout(()=>setUploadMsg(''),3000)
    setPage('library')
  }

  const deleteAttempt = (id) => {
    const updated = attempts.filter(a=>a.id!==id)
    setAttempts(updated)
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(updated))
  }

  const q=Qs[cur], ua=ans[cur], ak=(q?.ans||'').toUpperCase().trim()

  const getDotState = (i) => {
    const a=ans[i],m=marked[i],v=visited[i]||i===0,h=a&&a!=='skip'
    if(h&&m) return 'answered-marked'
    if(h)    return 'answered'
    if(m)    return 'marked-only'
    if(v||a==='skip') return 'skipped'
    return 'untouched'
  }

  const stats={
    a:  Qs.filter((_,i)=>getDotState(i)==='answered').length,
    am: Qs.filter((_,i)=>getDotState(i)==='answered-marked').length,
    s:  Qs.filter((_,i)=>{const s=getDotState(i);return s==='skipped'||s==='marked-only'}).length,
    r:  Qs.filter((_,i)=>getDotState(i)==='untouched').length
  }

  const optCls=(lbl)=>{const sel=ua===lbl;if(reviewing)return lbl===ak?'opt cor':sel?'opt wrg':'opt';return sel?'opt sel':'opt'}

  const filt=t=>{const q2=search.toLowerCase();return(!q2||t.title.toLowerCase().includes(q2))&&(filter==='all'||t.subject===filter)}
  const countAll=(tr)=>{if(!tr)return 0;let n=(tr.tests||[]).filter(filt).length;Object.values(tr.folders||{}).forEach(f=>n+=countAll(f));return n}
  const renderTree=(tr,depth=0,prefix='')=>{
    if(!tr)return null
    return(<div style={{marginLeft:depth>0?18:0}}>
      {Object.entries(tr.folders||{}).map(([name,sub])=>{
        if(!countAll(sub))return null
        const key=prefix+name,open=openFolders[key],cnt=countAll(sub)
        return(<div key={key} style={{marginBottom:8}}>
          <div className="folder-row" onClick={()=>setOpenFolders(p=>({...p,[key]:!p[key]}))}>
            <span>{open?'📂':'📁'}</span>
            <span style={{fontWeight:700,fontSize:'.88rem',flex:1}}>{name}</span>
            <span className="folder-count">{cnt} test{cnt!==1?'s':''}</span>
            <span style={{color:'#888',fontSize:'.78rem'}}>{open?'▾':'▸'}</span>
          </div>
          {open&&<div style={{marginTop:8,paddingLeft:10,borderLeft:'2px solid #e0e0e0'}}>{renderTree(sub,depth+1,key+'/')}</div>}
        </div>)
      })}
      {(tr.tests||[]).filter(filt).length>0&&(
        <div className="test-grid" style={{marginTop:depth>0?10:0}}>
          {(tr.tests||[]).filter(filt).map((t,i)=>(
            <TestCard key={t.path||t.id} t={t} ci={i} globalLoading={cbtLoading}
              onCBT={()=>startFromTree(t.path)}
              attempt={attempts.find(a=>a.testId===t.id||a.testId===(t.path))}
              onAnalyse={async att=>{
                try {
                  const tp = att.testPath || att.testId
                  const tiny = {
                    testTitle:att.testTitle, subject:att.subject, date:att.date,
                    score:att.score, maxScore:att.maxScore, accuracy:att.accuracy,
                    correct:att.correct, wrong:att.wrong, skipped:att.skipped, unattempted:att.unattempted,
                    duration:att.duration, marksCorrect:att.marksCorrect, marksWrong:att.marksWrong,
                    subjStats:att.subjStats,
                    answers:att.questions?.map(q=>({yourAnswer:q.yourAnswer,result:q.result,correctAnswer:q.correctAnswer}))
                  }
                  sessionStorage.setItem('tz_analyse', JSON.stringify(tiny))
                  window.location.href = '/analyser?src=auto&tp='+encodeURIComponent(tp||'')
                } catch(e) { alert('Could not load: '+e.message) }
              }}
              onReattempt={(att)=>{deleteAttempt(att.id);startFromTree(t.path)}}
            />
          ))}
        </div>
      )}
    </div>)
  }

  // ── Sidebar renderer (folders only) ──────────────────────────────────────
  const renderSidebar = (tr, prefix='') => {
    if (!tr) return null
    return <>
      {Object.entries(tr.folders||{}).map(([name, sub]) => {
        if (!countAll(sub)) return null
        const key = prefix+name
        const cnt = countAll(sub)
        return (
          <div key={key}>
            <button className={`lib-folder-item${activeFolder===key?' on':''}`}
              onClick={()=>setActiveFolder(activeFolder===key?null:key)}>
              <span style={{flex:1}}>{name}</span>
              <span className="lib-folder-cnt">{cnt}</span>
            </button>
            {/* Sub-folders */}
            {Object.keys(sub.folders||{}).length>0 && (
              <div style={{paddingLeft:12}}>
                {renderSidebar(sub, key+'/')}
              </div>
            )}
          </div>
        )
      })}
    </>
  }

  // ── Collect all tests for a folder path ──────────────────────────────────
  const getTestsForFolder = (tr, targetKey, prefix='') => {
    if (!tr) return []
    let tests = []
    for (const [name, sub] of Object.entries(tr.folders||{})) {
      const key = prefix+name
      if (key === targetKey) {
        // Collect all tests in this folder recursively
        const collectAll = (node) => {
          let t = [...(node.tests||[])]
          Object.values(node.folders||{}).forEach(f => t = t.concat(collectAll(f)))
          return t
        }
        return collectAll(sub)
      }
      // Check sub-folders
      const found = getTestsForFolder(sub, targetKey, key+'/')
      if (found.length > 0) return found
    }
    return tests
  }

  // ── Test row component (list style like screenshot) ───────────────────────
  const TestRow = ({ t, ci }) => {
    const att = attempts.find(a=>a.testId===t.id||a.testId===t.path)
    return (
      <div className={`trow-card${cbtLoading?' trow-dim':''}`}>
        <div className="trow-left">
          <div className="trow-status-dot" style={{background: att?'#22c55e':'#e0e4ff', border: att?'none':'1.5px solid #c5cae9'}}/>
          <div style={{flex:1,minWidth:0}}>
            <div className="trow-title">{t.title}</div>
            <div className="trow-meta">
              {t.subject||'BITSAT'} · {t.questionCount||t.questions?.length||'?'} Questions · +{t.mCor||3}/−{t.mNeg||1} · {t.dur||180} min
              {t.hasBonus && <span className="trow-bonus">Bonus</span>}
            </div>
            {att && (
              <div className="trow-att-row">
                <span className="trow-att-score" style={{color:att.score>=0?'#2e7d32':'#c62828'}}>Score: {att.score}/{att.maxScore}</span>
                <span className="trow-att-sep">·</span>
                <span className="trow-att-acc">{att.accuracy}% accuracy</span>
                <span className="trow-att-sep">·</span>
                <span className="trow-att-date">{new Date(att.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
              </div>
            )}
          </div>
        </div>
        <div className="trow-actions">
          {att && <>
            <button className="trow-btn outline" onClick={async()=>{
              if(cbtLoading)return
              try{
                const tp=att.testPath||att.testId
                const tiny={testTitle:att.testTitle,subject:att.subject,date:att.date,score:att.score,maxScore:att.maxScore,accuracy:att.accuracy,correct:att.correct,wrong:att.wrong,skipped:att.skipped,unattempted:att.unattempted,duration:att.duration,marksCorrect:att.marksCorrect,marksWrong:att.marksWrong,subjStats:att.subjStats,answers:att.questions?.map(q=>({yourAnswer:q.yourAnswer,result:q.result,correctAnswer:q.correctAnswer}))}
                sessionStorage.setItem('tz_analyse',JSON.stringify(tiny))
                window.location.href='/analyser?src=auto&tp='+encodeURIComponent(tp||'')
              }catch(e){alert('Could not load: '+e.message)}
            }}>View Analysis</button>
            <button className="trow-btn outline" onClick={()=>{deleteAttempt(att.id);startFromTree(t.path)}}>Reattempt</button>
          </>}
          <button className="trow-btn primary" onClick={()=>!cbtLoading&&startFromTree(t.path)} disabled={cbtLoading}>
            {cbtLoading?'Loading…':'Start Test'}
          </button>
        </div>
      </div>
    )
  }

  // ── Main content area ─────────────────────────────────────────────────────
  const renderMainContent = () => {
    if (!activeFolder) {
      // Show all tests flat or intro
      const allTests = []
      const collect = (tr) => { (tr.tests||[]).forEach(t=>allTests.push(t)); Object.values(tr.folders||{}).forEach(collect) }
      collect(tree)
      const filtered = allTests.filter(filt)
      if (!filtered.length && !treeLoad) return (
        <div className="lib-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c5cae9" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <div>Select a category from the left panel</div>
        </div>
      )
      return <div className="trow-list">{filtered.map((t,i)=><TestRow key={t.path||t.id} t={t} ci={i}/>)}</div>
    }
    if (activeFolder.startsWith('saved:')) {
      const tid = activeFolder.replace('saved:','')
      const t = savedTests.find(s=>s.id===tid)
      if (!t) return null
      return <div className="trow-list"><TestRow t={t} ci={0}/></div>
    }
    const tests = getTestsForFolder(tree, activeFolder).filter(filt)
    const folderName = activeFolder.split('/').pop()
    return (
      <div>
        <div className="lib-main-header">
          <h2 className="lib-main-title">{folderName}</h2>
          <div className="lib-main-filters">
            <div className="lib-search-wrap" style={{position:'relative',display:'inline-block'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="lib-search" style={{paddingLeft:28}} placeholder="Search tests…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
        </div>
        {!tests.length
          ? <div className="lib-empty"><div>No tests found</div></div>
          : <div className="trow-list">{tests.map((t,i)=><TestRow key={t.path||t.id} t={t} ci={i}/>)}</div>
        }
      </div>
    )
  }

  const isBitsatTest = isBITSAT(cfg.subject||'')
  const subjGroups={}
  if(isBitsatTest){Qs.forEach((q2,i)=>{const s=q2.subject||'Other';if(!subjGroups[s])subjGroups[s]=[];subjGroups[s].push(i)})}
  const navSubjects=isBitsatTest?BITSAT_SUBJECTS.filter(s=>subjGroups[s]?.length>0):[]

  // Bonus vars
  const mainIndices  = Qs.map((_,i)=>i).filter(i=>!Qs[i]?.isBonus)
  const bonusIndices = Qs.map((_,i)=>i).filter(i=>Qs[i]?.isBonus)
  const hasBonus     = bonusIndices.length>0
  const bonusUnlocked= mainIndices.length>0 && mainIndices.every(i=>ans[i]!==null&&ans[i]!==undefined)
  const inBonus      = bonusIndices.includes(cur)

  // Stats - real data only
  const myTestsGiven = attempts.length
  // Increment global counter on load (shared across this browser profile)
  const [globalTests, setGlobalTests] = useState(0)
  useEffect(()=>{
    try {
      const g = parseInt(localStorage.getItem('tz_global_tests')||'0')
      setGlobalTests(g)
    } catch(e){}
  },[])

  return (
    <>
      <Head>
        <title>TestZyro — BITSAT CBT</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231a237e'/><text y='24' x='4' font-size='22' font-weight='900' fill='%23fdd835' font-family='Arial'>TZ</text></svg>"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>

      <Nav active="Library"/>

      {page==='library' && (
        <div className="lib-shell anim">
          {/* Left Sidebar */}
          <div className="lib-sidebar">
            <div className="lib-sidebar-top">
              <div className="lib-search-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="lib-search" placeholder="Search tests…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <div className="lib-filters">
                {[['all','All'],['Not Attempted','Not Attempted'],['Attempted','Attempted']].map(([v,l])=>(
                  <button key={v} className={`lib-filter${filter===v?' on':''}`} onClick={()=>setFilter(v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="lib-folder-list">
              <div className="lib-section-label">MOCK TESTS</div>
              {treeLoad?<div className="loading-txt" style={{padding:'10px 14px'}}>Loading…</div>:renderSidebar(tree)}
              {savedTests.length>0&&<>
                <div className="lib-section-label" style={{marginTop:12}}>UPLOADED TESTS</div>
                {savedTests.map((t,i)=>(
                  <button key={t.id} className={`lib-folder-item${activeFolder===('saved:'+t.id)?' on':''}`}
                    onClick={()=>setActiveFolder('saved:'+t.id)}>
                    {t.title}
                  </button>
                ))}
              </>}
            </div>
            <div className="lib-sidebar-footer">
              <button className="btn-sm" onClick={loadTree} style={{width:'100%',justifyContent:'center'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Refresh Tests
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="lib-main">
            {uploadMsg && <div className="flash-msg">{uploadMsg}</div>}

            {resumeData && (
              <div className="resume-banner">
                <div className="resume-banner-left">
                  <div className="resume-icon-wrap">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="10 15 15 12 10 9 10 15"/></svg>
                  </div>
                  <div>
                    <div className="resume-title">Unfinished Test</div>
                    <div className="resume-meta"><strong>{resumeData.cfg?.title}</strong> · {resumeData.ans?.filter(a=>a&&a!=='skip').length||0} answered · {fmt(Math.max(0,(resumeData.cfg?.dur*60||0)-resumeData.elapsed))} left</div>
                  </div>
                </div>
                <div className="resume-banner-right">
                  <button className="resume-btn" onClick={()=>resumeTest(resumeData)}>Resume</button>
                  <button className="discard-btn" onClick={discardResume}>Discard</button>
                </div>
              </div>
            )}

            {/* Hero typewriter */}
            {!activeFolder && <HeroTypewriter/>}

            {/* Stats */}
            {!activeFolder && myTestsGiven > 0 && (
              <div className="stats-bar">
                <div className="stat-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  <span><strong>{myTestsGiven}</strong> test{myTestsGiven!==1?'s':''} given by you</span>
                </div>
              </div>
            )}

            {/* What's new */}
            {!activeFolder && WHATS_NEW.length>0&&(
              <div className="whats-new">
                <div className="wn-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>What's New</div>
                <div className="wn-list">{WHATS_NEW.map((item,i)=>(<div key={i} className="wn-item"><span className="wn-date">{item.date}</span><span className="wn-text">{item.text}</span></div>))}</div>
              </div>
            )}

            {/* Test list for selected folder */}
            {renderMainContent()}
          </div>
        </div>
      )}

      {page==='upload-json'&&(
        <div className="wrap anim narrow">
          <div className="page-hero"><h2>📤 Upload JSON Test</h2><p>Add pre-built .json test files to your saved library</p></div>
          <DropZone multi onFiles={onJsonFiles}>
            <div className="up-icon">📋</div>
            <div className="up-title">Drop .json test files here</div>
            <div className="up-sub">TestZyro format JSON files</div>
            <label htmlFor="json-inp" className="btn-primary" style={{cursor:'pointer',display:'inline-block',padding:'9px 24px'}}>Choose JSON File(s)</label>
            <input id="json-inp" type="file" accept=".json" multiple style={{display:'none'}} onChange={e=>e.target.files.length&&onJsonFiles(Array.from(e.target.files))}/>
          </DropZone>
        </div>
      )}

      {cbtOn&&!result&&(
        <div className="cbt-app">
          <div className="cbt-top">
            <div className="cbt-top-left">
              <div className="cbt-test-title">{cfg.title}</div>
              <div className="cbt-test-meta">{Qs.length} Questions · +{cfg.mCor}/−{cfg.mNeg} · {cfg.dur} min</div>
            </div>
            <div className="cbt-top-right">
              <div className={`cbt-timer${secs<=300?' warn':''}`}>⏱ Time Left: <strong>{fmt(secs)}</strong></div>
              <button className="cbt-submit-btn" onClick={()=>doSubmit()}>Submit Test</button>
              <button className="cbt-exit-btn" onClick={exitCBT}>⏸ Save & Exit</button>
            </div>
          </div>

          {isBitsatTest&&navSubjects.length>0&&(
            <div className="subj-tabs">
              {navSubjects.map(s=>{
                const sc=getSubjColor(s),indices=subjGroups[s]||[],answered=indices.filter(i=>ans[i]&&ans[i]!=='skip').length,isActive=activeNavSubj===s&&!inBonus
                return(<button key={s} className={`subj-tab${isActive?' active':''}`}
                  style={isActive?{background:sc.bg,color:'#fff',borderColor:sc.bg}:{}}
                  onClick={()=>{setActiveNavSubj(s);const fi=subjGroups[s]?.[0];if(fi!==undefined)goTo(fi)}}>
                  <span className="subj-tab-label">{sc.label}</span>
                  <span className="subj-tab-name">{s}</span>
                  <span className="subj-tab-count">{answered}/{indices.length}</span>
                </button>)
              })}
              {hasBonus&&(
                <button className={`subj-tab bonus-tab${inBonus?' active':''} ${bonusUnlocked?'unlocked':'locked'}`}
                  onClick={()=>{
                    if(!bonusUnlocked){const rem=mainIndices.filter(i=>ans[i]===null||ans[i]===undefined).length;alert(`⚠️ Attempt all ${mainIndices.length} main questions first!\n${rem} still unanswered.`);return}
                    setActiveNavSubj('Bonus');if(bonusIndices[0]!==undefined)goTo(bonusIndices[0])
                  }}>
                  <span className="subj-tab-label">{bonusUnlocked?'🎁':'🔒'}</span>
                  <span className="subj-tab-name">Bonus</span>
                  <span className="subj-tab-count">{bonusUnlocked?`${bonusIndices.filter(i=>ans[i]&&ans[i]!=='skip').length}/${bonusIndices.length}`:`${mainIndices.filter(i=>ans[i]===null||ans[i]===undefined).length} left`}</span>
                </button>
              )}
            </div>
          )}

          <div className="cbt-body">
            <div className="qpanel">
              {q?.subject&&(
                <div className="section-banner" style={{background:q.isBonus?'#fff8e1':getSubjColor(q.subject).light,borderColor:q.isBonus?'#ff9800':getSubjColor(q.subject).dot,color:q.isBonus?'#e65100':getSubjColor(q.subject).bg}}>
                  Section: <strong>{q.isBonus?'🎁 Bonus':q.subject}</strong>
                  {q.type==='INTEGER'&&<span className="type-badge int">Integer Type</span>}
                  {q.type==='MCQ'&&<span className="type-badge mcq">Single Correct</span>}
                </div>
              )}
              <div className="q-header-row">
                <span className="qnum-label">Question {cur+1} of {Qs.length}</span>
                <span className="marks-info">+{q?.mCor||cfg.mCor||3} / −{q?.mNeg||cfg.mNeg||1}</span>
              </div>
              {/* Image always shows first if present */}
              {q?.images&&q.images.length>0&&(
                <div className="q-images">{q.images.map((img,i)=><img key={i} src={`data:image/png;base64,${img}`} alt="" style={{maxWidth:'100%',display:'block',margin:'0 auto 8px'}}/>)}</div>
              )}
              {!q?.images?.length&&q?.pageRef!=null&&cfg.pageImages?.[String(q.pageRef)]&&(
                <div className="q-images"><img src={`data:image/jpeg;base64,${cfg.pageImages[String(q.pageRef)]}`} alt="" style={{maxWidth:'100%',display:'block',margin:'0 auto'}}/></div>
              )}
              {/* Text shows only if no image */}
              {!q?.images?.length&&q?.pageRef==null&&(
                <div className="qtext" dangerouslySetInnerHTML={{__html:(q?.text||'').replace(/\n/g,'<br/>')}}/>
              )}
              {/* Options - only show text opts if they have real content (not just A/B/C/D) */}
              {q?.type==='MCQ'
                ?<div className="opts">{['A','B','C','D'].map((lbl,i)=>{
                  const optText = q.opts?.[i]||''
                  // If option text is just a single letter or empty, don't show text (image has it)
                  const hasRealText = optText.length > 1
                  return(
                    <div key={lbl} className={optCls(lbl)} onClick={()=>{if(!done&&!reviewing)setAnswer(lbl)}}>
                      <span className="olbl">{lbl}</span>
                      {hasRealText&&<span className="otext">{optText}</span>}
                    </div>
                  )
                })}</div>
                :<div className="int-section">
                  <div className="int-label">Enter numeric answer:</div>
                  <input className="int-inp" type="text" inputMode="decimal"
                    value={(ua&&ua!=='skip')?ua:''}
                    disabled={done||reviewing}
                    onChange={e=>setAnswer(e.target.value.trim()||null)}
                    placeholder="Type answer…"/>
                </div>
              }
              {reviewing&&<div className="ans-banner">✓ Correct Answer: <strong>{q?.ans||'?'}</strong></div>}
              {!done&&!reviewing&&(
                <div className="action-row">
                  <button className="btn-save-next" onClick={saveAndNext}>Save &amp; Next</button>
                  <button className="btn-skip" onClick={markForReview}>Mark for Review &amp; Next</button>
                  <button className="btn-clear" onClick={clearQ}>Clear Response</button>
                </div>
              )}
              <div className="nav-row">
                <button className="btn-prev" onClick={()=>goTo(Math.max(0,cur-1))}>← Previous</button>
                <button className="btn-next" onClick={()=>{
                  let next=cur+1
                  if(next<Qs.length&&Qs[next]?.isBonus&&!bonusUnlocked)return
                  if(next<Qs.length)goTo(next)
                }}>Next →</button>
              </div>
            </div>

            <div className="sb">
              <div className="sb-title">Question Paper</div>
              <div className="sb-legend">
                <div className="leg-item"><div className="leg-dot answered"/>Answered</div>
                <div className="leg-item"><div className="leg-dot skipped"/>Skipped</div>
                <div className="leg-item"><div className="leg-dot marked-only"/>Marked</div>
                <div className="leg-item"><div className="leg-dot answered-marked"/>Ans+Marked</div>
              </div>
              <div className="sb-stats-row">
                <div className="sb-stat"><span className="sb-stat-n green">{stats.a}</span><span className="sb-stat-l">Answered</span></div>
                <div className="sb-stat"><span className="sb-stat-n purple">{stats.am}</span><span className="sb-stat-l">Ans+Marked</span></div>
                <div className="sb-stat"><span className="sb-stat-n red">{stats.s}</span><span className="sb-stat-l">Marked</span></div>
                <div className="sb-stat"><span className="sb-stat-n gray">{stats.r}</span><span className="sb-stat-l">Remaining</span></div>
              </div>
              {isBitsatTest?(
                <div className="sb-sections">
                  {navSubjects.map(s=>{
                    const sc=getSubjColor(s),indices=subjGroups[s]||[],isAct=activeNavSubj===s&&!inBonus
                    return(<div key={s} className={`sb-section${isAct?' active':''}`}>
                      <div className="sb-section-hdr" style={{background:sc.light,color:sc.bg,borderLeft:`4px solid ${sc.dot}`}}
                        onClick={()=>{setActiveNavSubj(s);const fi=subjGroups[s]?.[0];if(fi!==undefined)goTo(fi)}}>
                        <span className="sb-section-label">{sc.label}</span>
                        <span className="sb-section-name">{s}</span>
                        <span className="sb-section-count">{indices.filter(i=>ans[i]&&ans[i]!=='skip').length}/{indices.length}</span>
                      </div>
                      {isAct&&(
                        <div className="qgrid">
                          {indices.map(i=>{const state=getDotState(i),isCur=i===cur;return(
                            <div key={i} className={`qdot${isCur?' current':' '+state}`} onClick={()=>{goTo(i);setActiveNavSubj(s)}} style={{position:'relative'}}>
                              {i+1}{state==='answered-marked'&&<span className="dot-arrow">▸</span>}
                            </div>
                          )})}
                        </div>
                      )}
                    </div>)
                  })}
                  {hasBonus&&(
                    <div className={`sb-section${inBonus?' active':''}`}>
                      <div className="sb-section-hdr"
                        style={{background:bonusUnlocked?'#fff8e1':'#f5f5f5',color:bonusUnlocked?'#e65100':'#aaa',borderLeft:`4px solid ${bonusUnlocked?'#ff9800':'#ccc'}`}}
                        onClick={()=>{if(!bonusUnlocked){alert(`⚠️ Attempt all main questions first!`);return}setActiveNavSubj('Bonus');if(bonusIndices[0]!==undefined)goTo(bonusIndices[0])}}>
                        <span className="sb-section-label">{bonusUnlocked?'🎁':'🔒'}</span>
                        <span className="sb-section-name">Bonus</span>
                        <span className="sb-section-count">{bonusUnlocked?`${bonusIndices.filter(i=>ans[i]&&ans[i]!=='skip').length}/${bonusIndices.length}`:'Locked'}</span>
                      </div>
                      {inBonus&&bonusUnlocked&&(
                        <div className="qgrid">
                          {bonusIndices.map(i=>{const state=getDotState(i),isCur=i===cur;return(
                            <div key={i} className={`qdot${isCur?' current':' '+state}`} onClick={()=>{goTo(i);setActiveNavSubj('Bonus')}} style={{position:'relative'}}>
                              {i+1}{state==='answered-marked'&&<span className="dot-arrow">▸</span>}
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ):(
                <div className="qgrid" style={{padding:'8px'}}>
                  {Qs.map((_,i)=>{const state=getDotState(i),isCur=i===cur;return(
                    <div key={i} className={`qdot${isCur?' current':' '+state}`} onClick={()=>goTo(i)} style={{position:'relative'}}>
                      {i+1}{state==='answered-marked'&&<span className="dot-arrow">▸</span>}
                    </div>
                  )})}
                </div>
              )}
              <div className="sb-submit-area">
                <button className="sb-submit-btn" onClick={()=>doSubmit()}>Submit Test</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result&&(
        <div className="result-overlay">
          <div className="result-box">
            <div className="res-head">
              <div className="res-trophy">{result.pct>=80?'🏆':result.pct>=60?'🎯':result.pct>=40?'📚':'💪'}</div>
              <div className="res-title">Test Submitted!</div>
              <div className="res-test-name">{cfg.title}</div>
              <div className="res-score" style={{color:result.score>=0?'#4ade80':'#f87171'}}>{result.score}</div>
              <div className="res-max">out of {result.max} (+{cfg.mCor}/−{cfg.mNeg})</div>
              <div className="res-pct" style={{color:result.pct>=60?'#4ade80':'#fbbf24'}}>{result.pct}% accuracy</div>
            </div>
            {result.subjStats&&Object.keys(result.subjStats).length>1&&(
              <div className="res-subj-breakdown">
                <div className="res-subj-title">Subject-wise Performance</div>
                {Object.entries(result.subjStats).map(([s,st])=>{
                  const sc=getSubjColor(s),total=st.cor+st.wrg+st.skp+st.un,pct=total?Math.round(st.cor/total*100):0
                  return(<div key={s} className="res-subj-row">
                    <span className="res-subj-badge" style={{background:sc.light,color:sc.bg}}>{sc.label}</span>
                    <span className="res-subj-name">{s}</span>
                    <span style={{color:'#4ade80',fontWeight:700,fontSize:'.8rem'}}>✓{st.cor}</span>
                    <span style={{color:'#f87171',fontWeight:700,fontSize:'.8rem'}}>✗{st.wrg}</span>
                    <span style={{fontWeight:700,fontSize:'.8rem',color:pct>=60?'#4ade80':'#fbbf24'}}>{pct}%</span>
                  </div>)
                })}
              </div>
            )}
            <div className="res-grid">
              {[['✓',result.cor,'Correct','#4ade80'],['✗',result.wrg,'Wrong','#f87171'],['↩',result.skp,'Marked','#fbbf24'],['—',result.un,'Not Attempted','#888']].map(([ic,n,l,c])=>(
                <div key={l} className="res-cell"><div className="res-cell-n" style={{color:c}}>{n}</div><div className="res-cell-l">{ic} {l}</div></div>
              ))}
            </div>
            <div className="res-actions">
              <button className="btn-download" onClick={()=>downloadOutputFile(result)}>📥 Download Output</button>
              <button className="btn-review" onClick={async ()=>{
                try {
                  const tiny = {
                    testTitle:cfg.title, subject:cfg.subject, date:new Date().toISOString(),
                    score:result.score, maxScore:result.max, accuracy:result.pct,
                    correct:result.cor, wrong:result.wrg, skipped:result.skp, unattempted:result.un,
                    duration:result.elapsed, marksCorrect:cfg.mCor, marksWrong:cfg.mNeg,
                    subjStats:result.subjStats,
                    answers:result.answers.map((a,i)=>({
                      yourAnswer:a,
                      correctAnswer:Qs[i]?.ans,
                      result:!a?'unattempted':a==='skip'?'skipped':((Qs[i]?.ans||'').toUpperCase().trim()===(a||'').toUpperCase().trim())?'correct':'wrong'
                    }))
                  }
                  sessionStorage.setItem('tz_analyse', JSON.stringify(tiny))
                  const tp = cfg.testPath || cfg.id
                  window.location.href = '/analyser?src=auto&tp='+encodeURIComponent(tp||'')
                } catch(e) { alert('Could not load: '+e.message) }
              }}>📊 Analyse Test</button>
              <button className="btn-back-lib" onClick={()=>{setResult(null);setCbtOn(false);setCbtLoading(false);setPage('library')}}>📚 Library</button>
            </div>
            <div className="res-download-note">💡 Your attempt is auto-saved — click Analyse on the test card anytime</div>
          </div>
        </div>
      )}
    </>
  )
}

function HeroTypewriter() {
  const words = ['BITSAT', 'JEE Main', 'JEE Adv', 'BITSAT', 'Your Exam']
  const [wordIdx, setWordIdx] = useState(0)
  const [txt, setTxt] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [blink, setBlink] = useState(true)

  useEffect(()=>{
    const word = words[wordIdx]
    let timeout
    if (!deleting && txt === word) {
      timeout = setTimeout(()=>setDeleting(true), 1600)
    } else if (deleting && txt === '') {
      setDeleting(false)
      setWordIdx(i=>(i+1)%words.length)
    } else if (deleting) {
      timeout = setTimeout(()=>setTxt(t=>t.slice(0,-1)), 60)
    } else {
      timeout = setTimeout(()=>setTxt(word.slice(0,txt.length+1)), 100)
    }
    return ()=>clearTimeout(timeout)
  },[txt, deleting, wordIdx])

  useEffect(()=>{
    const t = setInterval(()=>setBlink(b=>!b), 530)
    return ()=>clearInterval(t)
  },[])

  return (
    <div className="hero-tw">
      <div className="hero-tw-inner">
        <div className="hero-tw-label">CBT Practice for</div>
        <div className="hero-tw-word">
          {txt}<span className="hero-tw-cursor" style={{opacity:blink?1:0}}>|</span>
        </div>
        <div className="hero-tw-sub">Full-length mock tests · Detailed analysis · BITSAT pattern</div>
      </div>
    </div>
  )
}

function SecTitle({children,style}) {
  return <div className="sec-ttl" style={style}>{children}</div>
}

function TestCard({t, ci, onCBT, onDel, globalLoading, attempt, onAnalyse, onReattempt}) {
  const PALETTE=['#1a237e','#1b5e20','#b71c1c','#4a148c','#e65100','#006064','#37474f']
  const accent = t.accentColor||PALETTE[ci%PALETTE.length]
  const subj = t.subject||'BITSAT'
  const isBitsat = subj.toUpperCase().includes('BITSAT')
  return (
    <div className={`tc${globalLoading?' tc-dimmed':''}`}>
      <div style={{height:5,background:accent}}/>
      <div style={{padding:'14px 16px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span className="tc-badge" style={{background:`${accent}18`,color:accent,border:`1px solid ${accent}30`}}>{subj}</span>
          {t.source&&<span style={{fontSize:'.6rem',color:'#999',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.source}</span>}
        </div>
        <div className="tc-title">{t.title}</div>
        <div className="tc-meta">
          <span>{t.questionCount||t.questions?.length||'?'} Questions</span>
          <span>·</span><span>{t.dur||180} min</span>
          <span>·</span><span>+{t.mCor||3} / −{t.mNeg||1}</span>
        </div>
        {isBitsat&&(
          <div className="tc-sections">
            {['PHY','CHEM','MATH','ENG'].map(s=><span key={s} className="tc-section-dot">{s}</span>)}
            {t.hasBonus&&<span className="tc-section-dot" style={{background:'#fff8e1',color:'#e65100',border:'1px solid #ffcc80'}}>🎁 BON</span>}
          </div>
        )}
        {/* Past attempt row */}
        {attempt && (
          <div className="tc-attempt">
            <div className="tc-att-info">
              <span className="tc-att-score" style={{color:attempt.score>=0?'#2e7d32':'#c62828'}}>Score: {attempt.score}/{attempt.maxScore}</span>
              <span className="tc-att-acc">({attempt.accuracy}%)</span>
              <span className="tc-att-date">{new Date(attempt.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
            </div>
            <div className="tc-att-btns">
              <button className="tc-analyse-btn" onClick={()=>onAnalyse(attempt)}>📊 Analyse</button>
              <button className="tc-reattempt-btn" style={{background:accent}} onClick={()=>onReattempt(attempt)}>↺ Reattempt</button>
            </div>
          </div>
        )}
        {globalLoading&&<div className="tc-loading-notice">⏳ Loading test… please wait</div>}
        {!attempt && (
          <div className="tc-actions">
            <button className="tc-cbt-btn" style={{background:globalLoading?'#9e9e9e':accent,cursor:globalLoading?'not-allowed':'pointer'}}
              onClick={globalLoading?undefined:onCBT} disabled={globalLoading}>
              {globalLoading?'⏳ Loading…':'🎯 Start CBT'}
            </button>
            {onDel&&!globalLoading&&<button className="tc-del-btn" onClick={onDel}>✕</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function DropZone({children,onFile,onFiles,multi}) {
  const [drag,setDrag]=useState(false)
  const handle=files=>{if(!files.length)return;if(multi&&onFiles)onFiles(Array.from(files));else if(onFile)onFile(files[0])}
  return <div className={`up-zone${drag?' drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files)}}>{children}</div>
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg,#f0f4ff);color:var(--text,#1a1a2e);font-family:'Inter',sans-serif;min-height:100vh;transition:background .25s,color .25s}
/* Header */
.hdr{background:#1a237e;color:white;padding:0 20px;display:flex;align-items:center;height:56px;gap:10px;box-shadow:0 2px 12px rgba(26,35,126,.4);position:sticky;top:0;z-index:100}
.logo{display:flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0}
.logo-mark{width:34px;height:34px;background:#fdd835;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:900;font-size:.82rem;color:#1a237e;letter-spacing:-.5px}
.logo-txt{font-weight:800;font-size:1.05rem;color:white;letter-spacing:-.3px}.logo-txt span{color:#fdd835}
.nav{display:flex;align-items:center;gap:2px;flex:1;overflow-x:auto}
.nb{padding:6px 11px;border-radius:6px;font-family:'Inter',sans-serif;font-weight:500;font-size:.78rem;cursor:pointer;border:none;background:transparent;color:rgba(255,255,255,.75);transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0}
.nb:hover{color:white;background:rgba(255,255,255,.12)}.nb.active{background:rgba(255,255,255,.2);color:white;font-weight:600}
.dark-toggle{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:white;width:34px;height:34px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}
.dark-toggle:hover{background:rgba(255,255,255,.22)}
/* Layout */
.wrap{max-width:1060px;margin:0 auto;padding:24px 18px 80px}.narrow{max-width:800px}
/* Sidebar library layout */
.lib-shell{display:flex;height:calc(100vh - 56px);overflow:hidden;background:var(--bg,#f0f4ff)}
.lib-sidebar{width:260px;flex-shrink:0;background:var(--surface,white);border-right:1px solid var(--border,#e0e4ff);display:flex;flex-direction:column;overflow:hidden}
.lib-sidebar-top{padding:12px;border-bottom:1px solid var(--border,#e0e4ff)}
.lib-search-wrap{position:relative;margin-bottom:8px}
.lib-search{width:100%;padding:7px 10px 7px 30px;background:var(--surface2,#f5f7ff);border:1.5px solid var(--border,#e0e4ff);border-radius:8px;font-family:'Inter',sans-serif;font-size:.78rem;color:var(--text,#1a1a2e);outline:none;transition:border-color .15s}
.lib-search:focus{border-color:#1a237e}
.lib-filters{display:flex;gap:4px;flex-wrap:wrap}
.lib-filter{padding:4px 10px;border-radius:20px;font-size:.68rem;font-weight:600;cursor:pointer;border:1.5px solid var(--border,#e0e4ff);background:transparent;color:var(--muted,#6b7280);font-family:'Inter',sans-serif;transition:all .13s;white-space:nowrap}
.lib-filter.on{background:#1a237e;color:white;border-color:#1a237e}
.lib-folder-list{flex:1;overflow-y:auto;padding:8px 0}
.lib-section-label{font-size:.58rem;font-weight:800;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:2px;padding:10px 14px 4px;font-family:'JetBrains Mono',monospace}
.lib-folder-item{display:flex;align-items:center;width:100%;padding:8px 14px;background:transparent;border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:.82rem;font-weight:500;color:var(--text2,#374151);text-align:left;transition:all .13s;gap:6px}
.lib-folder-item:hover{background:var(--surface2,#f5f7ff);color:#1a237e}
.lib-folder-item.on{background:#e8eaf6;color:#1a237e;font-weight:700;border-left:3px solid #1a237e}
.lib-folder-cnt{font-size:.62rem;font-family:'JetBrains Mono',monospace;color:var(--muted,#9ca3af);background:var(--surface2,#f0f0f0);padding:1px 6px;border-radius:10px;margin-left:auto}
.lib-sidebar-footer{padding:10px 12px;border-top:1px solid var(--border,#e0e4ff)}
.lib-upload-btn{display:flex;align-items:center;gap:7px;width:100%;padding:8px 12px;background:var(--surface2,#f5f7ff);border:1.5px dashed var(--border,#c5cae9);border-radius:8px;color:#1a237e;font-family:'Inter',sans-serif;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;justify-content:center}
.lib-upload-btn:hover{background:#e8eaf6;border-color:#1a237e}
/* Main content area */
.lib-main{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}
.lib-main-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px}
.lib-main-title{font-size:1.3rem;font-weight:800;color:var(--text,#1a1a2e);letter-spacing:-.3px}
.lib-main-filters{display:flex;gap:8px;align-items:center}
.lib-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:12px;color:var(--muted,#9ca3af);font-size:.86rem;padding:60px 0;text-align:center}
/* Test rows (list style) */
.trow-list{display:flex;flex-direction:column;gap:10px}
.trow-card{background:var(--surface,white);border:1px solid var(--border,#e0e4ff);border-radius:12px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;transition:all .18s;flex-wrap:wrap}
.trow-card:hover{border-color:#1a237e;box-shadow:0 4px 16px rgba(26,35,126,.08)}
.trow-dim{opacity:.6;pointer-events:none}
.trow-left{display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0}
.trow-status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px}
.trow-title{font-weight:700;font-size:.92rem;color:var(--text,#1a1a2e);margin-bottom:4px}
.trow-meta{font-size:.72rem;color:var(--muted,#6b7280);font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.trow-bonus{background:#fff3e0;color:#e65100;border:1px solid #ffcc80;padding:1px 7px;border-radius:10px;font-size:.6rem;font-weight:700}
.trow-att-row{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:.72rem;flex-wrap:wrap}
.trow-att-score{font-weight:700;font-family:'JetBrains Mono',monospace}
.trow-att-acc{color:var(--muted,#6b7280)}
.trow-att-date{color:var(--muted,#9ca3af);font-family:'JetBrains Mono',monospace}
.trow-att-sep{color:var(--muted,#9ca3af)}
.trow-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.trow-btn{padding:8px 18px;border-radius:20px;font-family:'Inter',sans-serif;font-weight:600;font-size:.78rem;cursor:pointer;transition:all .15s;white-space:nowrap;letter-spacing:.1px}
.trow-btn.outline{background:transparent;border:1.5px solid var(--border,#e0e4ff);color:var(--text,#374151)}
.trow-btn.outline:hover{border-color:#1a237e;color:#1a237e;background:#f0f4ff}
.trow-btn.primary{border:1.5px solid #1a237e;background:white;color:#1a237e;font-weight:700}
.trow-btn.primary:hover{background:#1a237e;color:white}
.trow-btn:disabled{opacity:.5;cursor:not-allowed}
.anim{animation:up .3s ease both}
/* Stats bar */
.stats-bar{background:var(--surface,white);border:1px solid var(--border,#e0e4ff);border-radius:10px;padding:10px 18px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:.78rem;color:var(--muted,#666)}
.stat-item{display:flex;align-items:center;gap:6px}
.stat-item strong{color:var(--text,#1a1a2e);font-weight:700}
.stat-divider{width:1px;height:16px;background:var(--border,#e0e4ff)}
.stat-dot-live{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 1.5s ease infinite;flex-shrink:0}
/* Page top */
.page-top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.page-top h2{font-size:1.4rem;font-weight:800;color:var(--text,#1a1a2e);letter-spacing:-.4px}.page-top p{font-size:.8rem;color:var(--muted,#666);margin-top:3px}
/* Toolbar */
.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.search-inp{flex:1;min-width:160px;background:var(--surface,white);border:1.5px solid var(--border,#e0e4ff);border-radius:8px;padding:8px 12px;color:var(--text,#1a1a2e);font-family:'Inter',sans-serif;font-size:.82rem;outline:none;transition:border-color .2s}
.search-inp:focus{border-color:#1a237e}
.fbtns{display:flex;gap:4px;flex-wrap:wrap}
.fbtn{padding:6px 12px;border-radius:6px;font-size:.72rem;font-weight:700;cursor:pointer;border:1.5px solid var(--border,#e0e4ff);background:var(--surface,white);color:var(--muted,#666);font-family:'JetBrains Mono',monospace;transition:all .13s}
.fbtn.on,.fbtn:hover{border-color:#1a237e;color:#1a237e;background:#e8eaf6}
/* Folder */
.folder-row{display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--surface,white);border:1px solid var(--border,#e0e4ff);border-radius:10px;padding:10px 14px;transition:all .15s;user-select:none;margin-bottom:4px}
.folder-row:hover{border-color:#1a237e;box-shadow:0 2px 8px rgba(26,35,126,.08)}
.folder-count{font-size:.65rem;font-family:'JetBrains Mono',monospace;color:var(--muted,#888);background:var(--surface2,#f5f5f5);padding:2px 8px;border-radius:4px}
.loading-txt{color:var(--muted,#888);font-size:.82rem;padding:16px 0}
.test-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.flash-msg{background:#e8f5e9;border:1px solid #a5d6a7;color:#2e7d32;padding:10px 16px;border-radius:8px;margin-bottom:14px;font-size:.83rem;font-weight:600}
/* What's New */
.whats-new{background:var(--surface,white);border:1px solid var(--border,#e0e4ff);border-left:3px solid #1a237e;border-radius:10px;padding:12px 16px;margin-bottom:20px}
.wn-title{font-size:.65rem;font-weight:800;color:#1a237e;text-transform:uppercase;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.wn-list{display:flex;flex-direction:column;gap:5px}
.wn-item{display:flex;align-items:baseline;gap:10px;font-size:.78rem}
.wn-date{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted,#aaa);flex-shrink:0;min-width:84px}
.wn-text{color:var(--text2,#333)}
/* Resume banner */
.resume-banner{background:linear-gradient(135deg,#1a237e,#311b92);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 4px 20px rgba(26,35,126,.35)}
.resume-banner-left{display:flex;align-items:center;gap:12px;flex:1}
.resume-icon-wrap{width:38px;height:38px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0}
.resume-title{font-weight:700;font-size:.92rem;color:white;margin-bottom:3px}
.resume-meta{font-size:.7rem;color:rgba(255,255,255,.72);font-family:'JetBrains Mono',monospace}
.resume-banner-right{display:flex;gap:8px;flex-shrink:0}
.resume-btn{background:#fdd835;color:#1a237e;border:none;padding:9px 20px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:800;font-size:.8rem;cursor:pointer;transition:all .15s}
.resume-btn:hover{background:#ffee58;transform:translateY(-1px)}
.discard-btn{background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.2);padding:8px 14px;border-radius:8px;font-family:'Inter',sans-serif;font-size:.78rem;cursor:pointer}
/* Btn */
.btn-sm{display:inline-flex;align-items:center;gap:6px;background:var(--surface,white);border:1.5px solid var(--border,#e0e4ff);color:var(--text,#1a237e);padding:8px 14px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:600;font-size:.78rem;cursor:pointer;transition:all .15s}
.btn-sm:hover{border-color:#1a237e;background:#e8eaf6}
/* Test card */
.tc{background:var(--surface,white);border:1px solid var(--border,#e0e0e0);border-radius:12px;overflow:hidden;transition:all .2s;box-shadow:0 1px 6px rgba(0,0,0,.06)}
.tc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.12)}
.tc-dimmed{opacity:.55;pointer-events:none}
.tc-badge{font-size:.6rem;font-weight:800;padding:3px 9px;border-radius:20px;font-family:'JetBrains Mono',monospace}
.tc-title{font-weight:700;font-size:.9rem;color:var(--text,#1a1a2e);margin-bottom:6px;line-height:1.4}
.tc-meta{display:flex;align-items:center;gap:5px;font-size:.68rem;color:var(--muted,#888);font-family:'JetBrains Mono',monospace;flex-wrap:wrap;margin-bottom:8px}
.tc-sections{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.tc-section-dot{font-size:.58rem;font-weight:800;padding:2px 7px;border-radius:4px;background:#e8eaf6;color:#1a237e;font-family:'JetBrains Mono',monospace}
.tc-loading-notice{font-size:.7rem;color:#e65100;background:#fff3e0;border:1px solid #ffcc80;border-radius:6px;padding:5px 10px;margin-bottom:8px;font-weight:600}
.tc-actions{display:flex;gap:7px}
.tc-cbt-btn{flex:1;padding:10px;border:none;border-radius:8px;color:white;font-family:'Inter',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer;transition:all .15s;letter-spacing:.2px}
.tc-cbt-btn:hover{opacity:.88;transform:translateY(-1px)}
.tc-del-btn{padding:9px 12px;background:var(--surface2,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:8px;cursor:pointer;color:var(--muted,#999);font-size:.75rem}
/* Attempt row on card */
.tc-attempt{background:var(--surface2,#f5f7ff);border:1px solid var(--border,#e0e4ff);border-radius:8px;padding:9px 11px;margin-bottom:10px}
.tc-att-info{display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap}
.tc-att-score{font-weight:800;font-size:.78rem;font-family:'JetBrains Mono',monospace}
.tc-att-acc{font-size:.72rem;color:var(--muted,#666)}
.tc-att-date{font-size:.65rem;color:var(--muted,#aaa);font-family:'JetBrains Mono',monospace;margin-left:auto}
.tc-att-btns{display:flex;gap:6px}
.tc-analyse-btn{flex:1;padding:7px 10px;border-radius:6px;font-family:'Inter',sans-serif;font-weight:600;font-size:.74rem;cursor:pointer;border:1.5px solid #1a237e;background:transparent;color:#1a237e;transition:all .15s}
.tc-analyse-btn:hover{background:#e8eaf6}
.tc-reattempt-btn{flex:1;padding:7px 10px;border-radius:6px;font-family:'Inter',sans-serif;font-weight:700;font-size:.74rem;cursor:pointer;border:none;color:white;transition:all .15s}
/* SecTitle */
.sec-ttl{font-size:.62rem;font-weight:800;color:var(--muted,#888);text-transform:uppercase;letter-spacing:2.5px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace}
.sec-ttl::after{content:'';flex:1;height:1px;background:var(--border,#e0e0e0)}
/* Upload page */
.page-hero{margin-bottom:20px}
.page-hero h2{font-size:1.4rem;font-weight:800;color:var(--text,#1a1a2e);margin-bottom:4px}
.page-hero p{font-size:.82rem;color:var(--muted,#666)}
.up-zone{background:var(--surface,white);border:2.5px dashed var(--border,#c5cae9);border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer;transition:all .2s}
.up-zone:hover,.up-zone.drag{border-color:#1a237e;background:#e8eaf6}
.up-icon{font-size:2.5rem;display:block;margin-bottom:10px}
.up-title{font-weight:700;font-size:.95rem;color:var(--text,#1a1a2e);margin-bottom:5px}
.up-sub{font-size:.78rem;color:var(--muted,#888);margin-bottom:16px}
.btn-primary{background:#1a237e;color:white;border:none;padding:10px 24px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.84rem;cursor:pointer;display:inline-block}
/* CBT */
.cbt-app{position:fixed;inset:0;display:flex;flex-direction:column;background:white;z-index:500}
.cbt-top{background:#1a237e;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex-shrink:0}
.cbt-top-left{display:flex;flex-direction:column;gap:2px}
.cbt-test-title{font-weight:700;font-size:.92rem;color:white}
.cbt-test-meta{font-size:.65rem;color:rgba(255,255,255,.65);font-family:'JetBrains Mono',monospace}
.cbt-top-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cbt-timer{font-family:'JetBrains Mono',monospace;font-size:.84rem;color:rgba(255,255,255,.9);background:rgba(255,255,255,.12);padding:6px 12px;border-radius:6px}
.cbt-timer.warn{color:#ffeb3b;animation:blink 1s ease infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.cbt-submit-btn{background:#fdd835;color:#1a237e;border:none;padding:8px 18px;border-radius:7px;font-family:'Inter',sans-serif;font-weight:800;font-size:.8rem;cursor:pointer}
.cbt-exit-btn{background:rgba(255,255,255,.12);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.2);padding:8px 14px;border-radius:7px;font-family:'Inter',sans-serif;font-size:.78rem;cursor:pointer}
/* Subject tabs */
.subj-tabs{background:#f8f9ff;border-bottom:1px solid #e0e4ff;padding:6px 12px;display:flex;gap:5px;overflow-x:auto;flex-shrink:0}
.subj-tab{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-family:'Inter',sans-serif;font-size:.76rem;font-weight:600;cursor:pointer;border:1.5px solid #e0e4ff;background:white;color:#546e7a;transition:all .15s;flex-shrink:0}
.subj-tab:hover{background:#e8eaf6;color:#1a237e}
.subj-tab.active{font-weight:700}
.subj-tab-label{font-family:'JetBrains Mono',monospace;font-size:.6rem;font-weight:800}
.subj-tab-name{font-size:.74rem}
.subj-tab-count{font-size:.6rem;font-family:'JetBrains Mono',monospace;background:#f0f0f0;padding:1px 6px;border-radius:3px}
.bonus-tab.locked{color:#aaa;border-color:#ddd;background:#fafafa}
.bonus-tab.unlocked{color:#e65100;background:#fff3e0;border-color:#ffcc80}
.bonus-tab.unlocked.active{background:#e65100!important;color:white!important;border-color:#e65100!important}
/* CBT body */
.cbt-body{display:flex;flex:1;overflow:hidden;min-height:0}
.qpanel{flex:1;overflow-y:auto;padding:18px 22px;background:white;display:flex;flex-direction:column;gap:14px}
.section-banner{font-size:.75rem;font-weight:700;padding:7px 14px;border-radius:7px;border:1px solid;display:flex;align-items:center;gap:8px;flex-shrink:0}
.type-badge{font-size:.62rem;font-weight:800;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.5)}
.q-header-row{display:flex;align-items:center;justify-content:space-between}
.qnum-label{font-family:'JetBrains Mono',monospace;font-size:.8rem;color:#546e7a;font-weight:600}
.marks-info{font-family:'JetBrains Mono',monospace;font-size:.72rem;color:#2e7d32;background:#e8f5e9;padding:3px 9px;border-radius:5px;border:1px solid #a5d6a7}
.q-images{text-align:center;background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;padding:10px;margin-bottom:4px}
.qtext{font-size:.93rem;line-height:1.9;color:#1a1a2e;padding:10px 0}
.opts{display:flex;flex-direction:column;gap:8px}
.opt{display:flex;align-items:center;gap:10px;background:white;border:1.5px solid #e0e4ff;border-radius:9px;padding:11px 14px;cursor:pointer;transition:all .15s}
.opt:hover{border-color:#1a237e;background:#f5f7ff}
.opt.sel{border-color:#1a237e;background:#e8eaf6}
.opt.cor{border-color:#2e7d32!important;background:#e8f5e9!important}
.opt.wrg{border-color:#c62828!important;background:#ffebee!important}
.olbl{font-family:'JetBrains Mono',monospace;font-size:.72rem;font-weight:800;color:#1a237e;min-width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#e8eaf6;border-radius:5px;flex-shrink:0}
.opt.sel .olbl{background:#1a237e;color:white}
.opt.cor .olbl{background:#2e7d32;color:white}
.opt.wrg .olbl{background:#c62828;color:white}
.otext{font-size:.88rem;color:#1a1a2e;line-height:1.55}
.int-section{display:flex;flex-direction:column;gap:8px}
.int-label{font-size:.78rem;color:#546e7a;font-weight:600}
.int-inp{border:2px solid #e0e4ff;border-radius:8px;padding:11px 14px;font-size:1rem;font-family:'JetBrains Mono',monospace;color:#1a1a2e;outline:none;width:100%;max-width:260px;transition:border-color .15s;background:white}
.int-inp:focus{border-color:#1a237e}
.ans-banner{background:#e8f5e9;border:1px solid #a5d6a7;color:#2e7d32;padding:10px 14px;border-radius:8px;font-size:.84rem;font-weight:600}
.action-row{display:flex;gap:8px;flex-wrap:wrap}
.btn-save-next{background:#1a237e;color:white;border:none;padding:10px 18px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer}
.btn-skip{background:white;color:#e65100;border:1.5px solid #ffcc80;padding:9px 16px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:600;font-size:.8rem;cursor:pointer}
.btn-clear{background:white;color:#546e7a;border:1.5px solid #e0e4ff;padding:9px 14px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:500;font-size:.78rem;cursor:pointer}
.nav-row{display:flex;align-items:center;justify-content:space-between;padding-top:4px;margin-top:auto}
.btn-prev,.btn-next{padding:9px 18px;border-radius:7px;font-family:'Inter',sans-serif;font-size:.78rem;font-weight:600;cursor:pointer;border:1.5px solid #e0e4ff;background:white;color:#1a237e;transition:all .15s}
.btn-prev:hover,.btn-next:hover{background:#e8eaf6;border-color:#1a237e}
/* Sidebar */
.sb{width:260px;flex-shrink:0;background:#f8f9ff;border-left:1px solid #e0e4ff;overflow-y:auto;display:flex;flex-direction:column;padding:12px}
.sb-title{font-size:.62rem;font-weight:800;color:#546e7a;text-transform:uppercase;letter-spacing:2px;font-family:'JetBrains Mono',monospace;margin-bottom:10px}
.sb-legend{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.leg-item{display:flex;align-items:center;gap:4px;font-size:.6rem;color:#888}
.leg-dot{width:10px;height:10px;border-radius:3px}
.leg-dot.answered{background:#2e7d32}.leg-dot.skipped{background:#fbbf24}.leg-dot.marked-only{background:#7c3aed}.leg-dot.answered-marked{background:#0891b2}
.sb-stats-row{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px}
.sb-stat{background:white;border:1px solid #e0e4ff;border-radius:7px;padding:7px;text-align:center}
.sb-stat-n{font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:800;display:block}.sb-stat-n.green{color:#2e7d32}.sb-stat-n.purple{color:#7c3aed}.sb-stat-n.red{color:#c62828}.sb-stat-n.gray{color:#888}
.sb-stat-l{font-size:.55rem;color:#888;display:block;margin-top:2px}
.sb-sections{display:flex;flex-direction:column;gap:6px}
.sb-section{background:white;border:1px solid #e0e4ff;border-radius:8px;overflow:hidden}
.sb-section-hdr{display:flex;align-items:center;gap:7px;padding:8px 10px;cursor:pointer;font-size:.76rem;font-weight:600}
.sb-section-label{font-family:'JetBrains Mono',monospace;font-size:.6rem;font-weight:800}
.sb-section-name{flex:1}
.sb-section-count{font-size:.6rem;font-family:'JetBrains Mono',monospace;font-weight:700}
.qgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;padding:8px}
.qdot{height:28px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;cursor:pointer;font-family:'JetBrains Mono',monospace;color:white;transition:all .1s;background:#e0e4ff;color:#546e7a}
.qdot.answered{background:#2e7d32;color:white}
.qdot.skipped{background:#fbbf24;color:white}
.qdot.marked-only{background:#7c3aed;color:white}
.qdot.answered-marked{background:#0891b2;color:white}
.qdot.current{outline:2.5px solid #1a237e;outline-offset:1px}
.dot-arrow{position:absolute;bottom:1px;right:2px;font-size:.4rem}
.sb-submit-area{margin-top:auto;padding-top:10px}
.sb-submit-btn{width:100%;background:#c62828;color:white;border:none;padding:11px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.84rem;cursor:pointer}
.sb-submit-btn:hover{background:#b71c1c}
/* Result overlay */
.result-overlay{position:fixed;inset:0;background:linear-gradient(135deg,#1a237e,#311b92);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;overflow-y:auto}
.result-box{background:white;border-radius:20px;padding:36px;max-width:500px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.4)}
.res-head{margin-bottom:20px}
.res-trophy{font-size:2.8rem;margin-bottom:8px}
.res-title{font-size:.72rem;font-weight:800;color:#546e7a;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px}
.res-test-name{font-size:.88rem;font-weight:600;color:#1a1a2e;margin-bottom:12px}
.res-score{font-family:'JetBrains Mono',monospace;font-size:3.5rem;font-weight:900;letter-spacing:-2px;line-height:1}
.res-max{font-size:.88rem;color:#888;margin-bottom:6px}
.res-pct{font-size:.9rem;font-weight:700;margin-bottom:4px}
.res-subj-breakdown{background:#f8f9ff;border-radius:12px;padding:14px;margin-bottom:18px;text-align:left}
.res-subj-title{font-size:.65rem;font-weight:800;color:#546e7a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;font-family:'JetBrains Mono',monospace}
.res-subj-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:.78rem}
.res-subj-badge{font-size:.58rem;font-weight:800;padding:2px 7px;border-radius:4px;font-family:'JetBrains Mono',monospace}
.res-subj-name{flex:1;font-weight:600}
.res-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.res-cell{background:#f8f9ff;border-radius:10px;padding:12px 6px;text-align:center}
.res-cell-n{font-family:'JetBrains Mono',monospace;font-size:1.6rem;font-weight:900;display:block;line-height:1;margin-bottom:4px}
.res-cell-l{font-size:.62rem;color:#888;text-transform:uppercase;letter-spacing:.5px}
.res-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.btn-download{background:#1a237e;color:white;border:none;padding:10px 18px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.btn-review{background:linear-gradient(135deg,#1565c0,#6a1b9a);color:white;border:none;padding:10px 18px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.btn-back-lib{background:#f0f4ff;color:#1a237e;border:1.5px solid #c5cae9;padding:10px 18px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.res-download-note{margin-top:10px;font-size:.72rem;color:#888}
/* Hero typewriter */
.hero-tw{background:linear-gradient(135deg,#1a237e 0%,#311b92 50%,#1565c0 100%);border-radius:16px;padding:32px 36px;margin-bottom:24px;position:relative;overflow:hidden}
.hero-tw::before{content:'';position:absolute;top:-40%;right:-10%;width:300px;height:300px;background:rgba(255,255,255,.04);border-radius:50%}
.hero-tw::after{content:'';position:absolute;bottom:-30%;left:5%;width:200px;height:200px;background:rgba(255,255,255,.03);border-radius:50%}
.hero-tw-inner{position:relative;z-index:1}
.hero-tw-label{font-size:.72rem;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;font-family:'JetBrains Mono',monospace}
.hero-tw-word{font-size:2.4rem;font-weight:900;color:#fdd835;letter-spacing:-1px;line-height:1.1;margin-bottom:10px;min-height:2.8rem;font-family:'Inter',sans-serif}
.hero-tw-cursor{color:#fdd835;font-weight:300}
.hero-tw-sub{font-size:.82rem;color:rgba(255,255,255,.7);font-weight:500}
`

