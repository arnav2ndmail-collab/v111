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
      // Load from local /api/tests (public/tests folder)
      const r = await fetch('/api/tests'); const d = await r.json()
      let merged = d
      // Also try loading from Supabase Storage if configured
      if (isSupabaseReady()) {
        try {
          const sb = getSupabase()
          const { data: files } = await sb.storage.from('tests').list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } })
          if (files && files.length > 0) {
            // Build folder structure from Supabase storage files
            for (const file of files) {
              if (file.id) { // it's a folder
                const { data: subFiles } = await sb.storage.from('tests').list(file.name, { limit: 200 })
                if (subFiles) {
                  for (const sf of subFiles) {
                    if (sf.name.endsWith('.json')) {
                      const folder = file.name
                      if (!merged.folders) merged.folders = {}
                      if (!merged.folders[folder]) merged.folders[folder] = { folders:{}, tests:[] }
                      if (!merged.folders[folder].tests) merged.folders[folder].tests = []
                      const { data: { publicUrl } } = sb.storage.from('tests').getPublicUrl(`${folder}/${sf.name}`)
                      const testName = sf.name.replace('.json','').replace(/_/g,' ')
                      merged.folders[folder].tests.push({
                        title: testName,
                        path: `__storage__${folder}/${sf.name}`,
                        id: `${folder}/${sf.name}`,
                        subject: 'BITSAT',
                        storageUrl: publicUrl
                      })
                    }
                  }
                }
              }
            }
          }
        } catch(e) { /* Storage not set up yet, ignore */ }
      }
      setTree(merged)
      const keys = Object.keys(merged.folders||{})
      if (keys.length) { setOpenFolders({ [keys[0]]: true }); setActiveFolder(keys[0]) }
    } catch(e) { console.warn('loadTree error:', e.message) }
    setTreeLoad(false)
  }

  const startFromTree = async (testPath) => {
    if (cbtLoading) return
    setCbtLoading(true)
    try {
      let d
      if (testPath && testPath.startsWith('__storage__')) {
        // Load from Supabase Storage
        const storageKey = testPath.replace('__storage__','')
        const sb = getSupabase()
        const { data: { publicUrl } } = sb.storage.from('tests').getPublicUrl(storageKey)
        const r = await fetch(publicUrl)
        d = await r.json()
        if (!d.questions) throw new Error('bad file')
        doLaunch(d.questions, { title:d.title||storageKey, dur:d.dur||180, mCor:d.mCor||3, mNeg:d.mNeg||1, id:storageKey, testPath:testPath, subject:d.subject, pageImages:d.pageImages||null })
      } else {
        const r = await fetch(`/api/test/${testPath}`)
        d = await r.json()
        if (!d.questions) throw new Error('bad file')
        doLaunch(d.questions, { title:d.title, dur:d.dur||180, mCor:d.mCor||3, mNeg:d.mNeg||1, id:d.id||testPath, testPath:testPath, subject:d.subject, pageImages:d.pageImages||null })
      }
    } catch(e) { alert('Failed to load: '+e.message); setCbtLoading(false) }
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

  const doSubmit = useCallback((auto=false) => {
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
    // Save to Supabase directly from client (no API route needed)
    if (isSupabaseReady() && sbUser) {
      try {
        const sb = getSupabase()
        await sb.from('test_attempts').insert({
          user_id: sbUser.id,
          test_id: cfg.id || cfg.testPath || cfg.title,
          test_path: cfg.testPath || cfg.id || '',
          test_title: cfg.title || 'Test',
          subject: cfg.subject || 'BITSAT',
          score: res.score || 0,
          max_score: res.max || 0,
          correct: res.cor || 0,
          wrong: res.wrg || 0,
          skipped: res.skp || 0,
          unattempted: res.un || 0,
          accuracy: res.pct || 0,
          duration: res.elapsed || 0,
          marks_correct: cfg.mCor || 3,
          marks_wrong: cfg.mNeg || 1,
          subj_stats: res.subjStats || {},
          answers: finalAns.map((a,i)=>({yourAnswer:a,correctAnswer:Qs[i]?.ans,result:!a?'unattempted':a==='skip'?'skipped':((Qs[i]?.ans||'').toUpperCase().trim()===(a||'').toUpperCase().trim())?'correct':'wrong'})),
          taken_at: new Date().toISOString()
        })
      } catch(e) { console.warn('Supabase save failed:', e.message) }
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
body{background:#0a0e1a;color:#f1f5f9;font-family:'Inter',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.anim{animation:fadeIn .3s ease}
/* Lib shell */
.lib-shell{display:flex;height:calc(100vh - 56px);overflow:hidden;background:#0a0e1a}
/* Sidebar */
.lib-sidebar{width:260px;flex-shrink:0;background:#141927;border-right:1px solid #2d3748;display:flex;flex-direction:column;overflow:hidden}
.lib-sidebar-top{padding:12px;border-bottom:1px solid #2d3748}
.lib-search-wrap{position:relative;margin-bottom:8px}
.lib-search{width:100%;padding:8px 10px 8px 32px;background:#0d1220;border:1.5px solid #2d3748;border-radius:10px;font-family:'Inter',sans-serif;font-size:.78rem;color:#f1f5f9;outline:none;transition:border-color .15s}
.lib-search::placeholder{color:#475569}
.lib-search:focus{border-color:#6366f1}
.lib-filters{display:flex;gap:4px;flex-wrap:wrap}
.lib-filter{padding:5px 12px;border-radius:20px;font-size:.7rem;font-weight:600;cursor:pointer;border:1.5px solid #2d3748;background:transparent;color:#64748b;font-family:'Inter',sans-serif;transition:all .15s}
.lib-filter.on{background:#6366f1;color:white;border-color:#6366f1}
.lib-folder-list{flex:1;overflow-y:auto;padding:6px 0}
.lib-section-label{font-size:.58rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:2px;padding:10px 14px 4px;font-family:'Inter',sans-serif}
.lib-folder-item{display:flex;align-items:center;width:100%;padding:9px 14px;background:transparent;border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:.82rem;font-weight:500;color:#94a3b8;text-align:left;transition:all .13s;gap:6px}
.lib-folder-item:hover{background:#1e293b;color:#f1f5f9}
.lib-folder-item.on{background:#1a2234;color:#6366f1;font-weight:600;border-left:3px solid #6366f1}
.lib-folder-cnt{font-size:.6rem;font-family:'Inter',sans-serif;color:#475569;background:#1a2234;padding:1px 7px;border-radius:10px;margin-left:auto}
.lib-sidebar-footer{padding:10px 12px;border-top:1px solid #2d3748}
/* Main content */
.lib-main{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:14px}
.lib-main-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px}
.lib-main-title{font-size:1.3rem;font-weight:700;color:white}
.lib-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:12px;color:#475569;font-size:.86rem;padding:60px 0;text-align:center}
/* Test rows */
.trow-list{display:flex;flex-direction:column;gap:8px}
.trow-card{background:#141927;border:1px solid #2d3748;border-radius:14px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;transition:all .2s;flex-wrap:wrap;cursor:default}
.trow-card:hover{border-color:#6366f1;background:#1a2234}
.trow-dim{opacity:.5;pointer-events:none}
.trow-left{display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0}
.trow-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:5px}
.trow-title{font-weight:600;font-size:.92rem;color:#f1f5f9;margin-bottom:4px}
.trow-meta{font-size:.72rem;color:#64748b;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.trow-bonus{background:rgba(249,115,22,.15);color:#f97316;border:1px solid rgba(249,115,22,.3);padding:1px 7px;border-radius:10px;font-size:.6rem;font-weight:700}
.trow-att-row{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:.72rem;flex-wrap:wrap}
.trow-att-sep{color:#334155}
.trow-att-acc{color:#64748b}
.trow-att-date{color:#475569}
.trow-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.trow-btn{padding:7px 16px;border-radius:20px;font-family:'Inter',sans-serif;font-weight:600;font-size:.76rem;cursor:pointer;transition:all .15s;white-space:nowrap}
.trow-btn.outline{background:transparent;border:1.5px solid #2d3748;color:#94a3b8}
.trow-btn.outline:hover{border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.05)}
.trow-btn.primary{border:1.5px solid #6366f1;background:transparent;color:#6366f1;font-weight:700}
.trow-btn.primary:hover{background:#6366f1;color:white}
.trow-btn:disabled{opacity:.4;cursor:not-allowed}
/* Resume banner */
.resume-banner{background:#1a2234;border:1px solid #6366f1;border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.resume-banner-left{display:flex;align-items:center;gap:12px}
.resume-icon-wrap{width:36px;height:36px;background:rgba(99,102,241,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#6366f1;flex-shrink:0}
.resume-title{font-weight:700;font-size:.88rem;color:white;margin-bottom:2px}
.resume-meta{font-size:.74rem;color:#64748b}
.resume-banner-right{display:flex;gap:8px}
.resume-btn{background:#6366f1;color:white;border:none;padding:8px 18px;border-radius:20px;font-family:'Inter',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer}
.discard-btn{background:transparent;border:1.5px solid #2d3748;color:#64748b;padding:8px 14px;border-radius:20px;font-family:'Inter',sans-serif;font-size:.78rem;cursor:pointer}
/* Stats bar */
.stats-bar{display:flex;align-items:center;gap:12px;background:#141927;border:1px solid #2d3748;border-radius:10px;padding:10px 16px;font-size:.78rem;color:#64748b;flex-wrap:wrap}
.stat-item{display:flex;align-items:center;gap:6px}.stat-item strong{color:#94a3b8}
.stat-divider{width:1px;height:14px;background:#2d3748}
/* What's new */
.whats-new{background:#141927;border:1px solid #2d3748;border-radius:12px;padding:14px 16px}
.wn-title{display:flex;align-items:center;gap:7px;font-size:.68rem;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}
.wn-item{display:flex;gap:10px;font-size:.76rem;padding:4px 0;border-bottom:1px solid #1e293b}
.wn-item:last-child{border-bottom:none}
.wn-date{color:#475569;font-size:.65rem;white-space:nowrap;padding-top:1px;min-width:80px}
.wn-text{color:#94a3b8}
/* Loading */
.loading-txt{color:#475569;font-size:.84rem;padding:20px;text-align:center}
/* Buttons */
.btn-sm{display:flex;align-items:center;gap:6px;background:transparent;border:1.5px solid #2d3748;color:#64748b;padding:6px 14px;border-radius:8px;font-family:'Inter',sans-serif;font-size:.76rem;cursor:pointer;transition:all .15s}
.btn-sm:hover{border-color:#6366f1;color:#6366f1}
/* Flash message */
.flash-msg{background:#1a2234;border:1px solid #10b981;color:#10b981;padding:10px 16px;border-radius:10px;font-size:.82rem}
/* Wrap for upload page */
.wrap{max-width:1060px;margin:0 auto;padding:24px 18px 80px}.narrow{max-width:800px}
/* Upload JSON */
.up-icon{font-size:2.5rem;margin-bottom:8px}
.up-title{font-weight:700;font-size:1rem;color:white;margin-bottom:4px}
.up-sub{font-size:.78rem;color:#64748b;margin-bottom:16px}
/* CBT App - full screen overlay */
.cbt-app{position:fixed;inset:0;display:flex;flex-direction:column;background:#0a0e1a;z-index:500}
/* CBT top bar */
.cbt-top{background:#141927;border-bottom:1px solid #2d3748;padding:0 20px;height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}
.cbt-top-left{display:flex;flex-direction:column;justify-content:center}
.cbt-test-title{font-weight:700;font-size:.9rem;color:white}
.cbt-test-meta{font-size:.68rem;color:#64748b}
.cbt-top-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.cbt-timer{font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:.88rem;font-weight:700;color:#94a3b8;background:#1a2234;border:1px solid #2d3748;padding:6px 14px;border-radius:8px}
.cbt-timer.warn{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,.1)}
.cbt-submit-btn{background:#6366f1;color:white;border:none;padding:8px 18px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer}
.cbt-submit-btn:hover{background:#5254cc}
.cbt-exit-btn{background:transparent;border:1.5px solid #2d3748;color:#64748b;padding:8px 14px;border-radius:8px;font-family:'Inter',sans-serif;font-size:.78rem;cursor:pointer}
.cbt-exit-btn:hover{border-color:#ef4444;color:#ef4444}
/* Subject tabs */
.subj-tabs{background:#141927;border-bottom:1px solid #2d3748;display:flex;gap:0;overflow-x:auto;flex-shrink:0}
.subj-tab{padding:10px 18px;font-family:'Inter',sans-serif;font-weight:600;font-size:.78rem;cursor:pointer;border:none;background:transparent;color:#64748b;transition:all .15s;border-bottom:2px solid transparent;white-space:nowrap}
.subj-tab:hover{color:#94a3b8}
.subj-tab.active{color:white;border-bottom-color:#6366f1}
/* CBT body */
.cbt-body{display:flex;flex:1;overflow:hidden;min-height:0}
/* Question panel */
.q-panel{flex:1;overflow-y:auto;padding:20px 24px;background:#0a0e1a}
.q-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.q-num{font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:.75rem;font-weight:700;background:#1a2234;border:1.5px solid #2d3748;color:#94a3b8;padding:4px 11px;border-radius:7px}
.q-subj{font-size:.68rem;font-weight:700;padding:3px 10px;border-radius:20px;font-family:'Inter',sans-serif}
.type-badge{font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:20px}
.type-badge.mcq{background:rgba(99,102,241,.15);color:#6366f1;border:1px solid rgba(99,102,241,.3)}
.type-badge.int{background:rgba(249,115,22,.15);color:#f97316;border:1px solid rgba(249,115,22,.3)}
/* Mark for review */
.mark-btn{margin-left:auto;background:transparent;border:1.5px solid #2d3748;color:#64748b;padding:5px 12px;border-radius:20px;font-family:'Inter',sans-serif;font-size:.72rem;cursor:pointer;transition:all .15s}
.mark-btn:hover{border-color:#f97316;color:#f97316}
.mark-btn.marked{background:rgba(249,115,22,.15);border-color:#f97316;color:#f97316}
/* Question image/text */
.q-content{background:#141927;border:1px solid #2d3748;border-radius:12px;padding:18px;margin-bottom:16px;min-height:60px}
.q-text{font-size:.92rem;line-height:1.9;color:#e2e8f0;white-space:pre-wrap}
/* Options */
.opts{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.opt{display:flex;align-items:center;gap:12px;background:#141927;border:1.5px solid #2d3748;border-radius:10px;padding:12px 14px;cursor:pointer;transition:all .18s}
.opt:hover{border-color:#6366f1;background:#1a2234}
.opt.sel{border-color:#6366f1;background:rgba(99,102,241,.1)}
.opt.cor{border-color:#10b981!important;background:rgba(16,185,129,.1)!important}
.opt.wrg{border-color:#ef4444!important;background:rgba(239,68,68,.1)!important}
.olbl{width:28px;height:28px;border-radius:7px;background:#1a2234;border:1.5px solid #2d3748;color:#94a3b8;font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.opt.sel .olbl{background:#6366f1;border-color:#6366f1;color:white}
.opt.cor .olbl{background:#10b981;border-color:#10b981;color:white}
.opt.wrg .olbl{background:#ef4444;border-color:#ef4444;color:white}
.otext{font-size:.88rem;color:#e2e8f0;line-height:1.6}
/* Integer input */
.int-section{margin-bottom:16px}
.int-label{font-size:.76rem;color:#64748b;margin-bottom:8px}
.int-inp{background:#141927;border:1.5px solid #2d3748;border-radius:10px;padding:12px 14px;color:white;font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:1.1rem;width:100%;max-width:280px;outline:none;transition:border-color .15s}
.int-inp:focus{border-color:#6366f1}
/* Answer banner */
.ans-banner{background:rgba(16,185,129,.1);border:1px solid #10b981;color:#10b981;padding:10px 14px;border-radius:8px;font-size:.82rem;margin-bottom:12px}
/* Nav actions */
.nav-actions{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #2d3748;flex-shrink:0}
.nav-save{flex:1;background:#6366f1;color:white;border:none;padding:9px;border-radius:8px;font-family:'Inter',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer}
.nav-save:hover{background:#5254cc}
.nav-skip{background:transparent;border:1.5px solid #2d3748;color:#64748b;padding:9px 16px;border-radius:8px;font-family:'Inter',sans-serif;font-size:.78rem;cursor:pointer}
.nav-skip:hover{border-color:#ef4444;color:#ef4444}
/* Question navigator */
.qnav{width:220px;flex-shrink:0;background:#141927;border-left:1px solid #2d3748;display:flex;flex-direction:column;overflow:hidden}
.qnav-hdr{padding:12px;border-bottom:1px solid #2d3748;font-size:.65rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px}
.qnav-dots{padding:10px;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;overflow-y:auto;flex:1}
.qdot{height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:.6rem;font-weight:700;cursor:pointer;color:white;transition:all .15s;border:none}
.qdot:hover{opacity:.8;transform:scale(1.05)}
.qnav-legend{padding:10px 12px;border-top:1px solid #2d3748;display:flex;flex-direction:column;gap:4px}
.ql-item{display:flex;align-items:center;gap:6px;font-size:.62rem;color:#475569}
.ql-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
/* Bonus tab */
.bonus-tab{background:rgba(249,115,22,.15);border:1.5px solid rgba(249,115,22,.3);color:#f97316;padding:6px 14px;border-radius:20px;font-family:'Inter',sans-serif;font-size:.76rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;border-top:none;border-bottom:2px solid transparent}
.bonus-tab.active{border-bottom-color:#f97316;background:rgba(249,115,22,.2)}
/* Result overlay */
.result-overlay{position:fixed;inset:0;background:#0a0e1a;display:flex;align-items:center;justify-content:center;z-index:600;padding:20px;overflow-y:auto}
.result-card{background:#141927;border:1px solid #2d3748;border-radius:20px;padding:36px;width:100%;max-width:640px;box-shadow:0 24px 80px rgba(0,0,0,.5)}
.res-title{font-size:1.4rem;font-weight:800;color:white;margin-bottom:4px}
.res-sub{font-size:.82rem;color:#64748b;margin-bottom:24px}
.res-score{font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:3.2rem;font-weight:900;margin-bottom:4px;line-height:1}
.res-max{font-size:1rem;color:#64748b;font-weight:400}
.res-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:20px 0}
.res-item{background:#1a2234;border-radius:10px;padding:14px;text-align:center}
.res-item-n{font-family:'JetBrains Mono','Roboto Mono',monospace;font-size:1.6rem;font-weight:800;margin-bottom:4px}
.res-item-l{font-size:.65rem;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.res-subj{margin:16px 0}
.res-subj-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e293b;font-size:.82rem}
.res-subj-row:last-child{border-bottom:none}
.res-subj-name{flex:1;color:#94a3b8}
.res-subj-score{font-family:'JetBrains Mono','Roboto Mono',monospace;font-weight:700}
.res-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
.btn-analyse{flex:1;background:#6366f1;color:white;border:none;padding:12px;border-radius:10px;font-family:'Inter',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer}
.btn-analyse:hover{background:#5254cc}
.btn-back-lib{flex:1;background:transparent;border:1.5px solid #2d3748;color:#64748b;padding:12px;border-radius:10px;font-family:'Inter',sans-serif;font-size:.88rem;cursor:pointer}
.btn-back-lib:hover{border-color:#6366f1;color:#6366f1}
.res-download-note{font-size:.72rem;color:#475569;text-align:center;margin-top:10px}
/* Hero typewriter */
.hero-tw{background:linear-gradient(135deg,#1a237e 0%,#312e81 100%);border-radius:16px;padding:28px 32px;margin-bottom:4px;overflow:hidden;position:relative;border:1px solid #2d3748}
.hero-tw::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 80% 50%,rgba(99,102,241,.2),transparent 60%)}
.hero-tw-inner{position:relative;z-index:1}
.hero-tw-label{font-size:.68rem;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:3px;margin-bottom:8px}
.hero-tw-word{font-size:2.4rem;font-weight:900;color:#fdd835;letter-spacing:-1px;line-height:1.1;margin-bottom:10px;min-height:2.8rem}
.hero-tw-cursor{color:#fdd835;font-weight:300}
.hero-tw-sub{font-size:.82rem;color:rgba(255,255,255,.6);font-weight:500}
`

