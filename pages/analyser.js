import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import Nav from '../components/Nav'

// ── Icons ──────────────────────────────────────────────────────────────────
const Ic = {
  correct:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  wrong:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  skip:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>,
  na:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  bookmark:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  clock:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chart:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  target:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  bolt:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  upload:    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  warning:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  star:      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

const SUBJ_ORDER = ['Physics','Chemistry','Maths','English & LR','Bonus']
const SC = {
  'Physics':      { bg:'#1565c0', grd:'linear-gradient(135deg,#1565c0,#1e88e5)', light:'#e3f2fd', dot:'#42a5f5', label:'PHY' },
  'Chemistry':    { bg:'#2e7d32', grd:'linear-gradient(135deg,#2e7d32,#43a047)', light:'#e8f5e9', dot:'#66bb6a', label:'CHEM' },
  'Maths':        { bg:'#c62828', grd:'linear-gradient(135deg,#c62828,#e53935)', light:'#ffebee', dot:'#ef5350', label:'MATH' },
  'English & LR': { bg:'#6a1b9a', grd:'linear-gradient(135deg,#6a1b9a,#8e24aa)', light:'#f3e5f5', dot:'#ab47bc', label:'ENG'  },
  'Bonus':        { bg:'#e65100', grd:'linear-gradient(135deg,#e65100,#f57c00)', light:'#fff3e0', dot:'#ffa726', label:'BON'  },
}
const getSC = s => SC[s] || { bg:'#37474f', grd:'linear-gradient(135deg,#37474f,#546e7a)', light:'#eceff1', dot:'#78909c', label:'Q' }

const RES = {
  correct:     { color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7', label:'Correct'     },
  wrong:       { color:'#c62828', bg:'#ffebee', border:'#ef9a9a', label:'Wrong'       },
  skipped:     { color:'#e65100', bg:'#fff3e0', border:'#ffcc80', label:'Skipped'     },
  unattempted: { color:'#546e7a', bg:'#eceff1', border:'#b0bec5', label:'Not Attempted'},
}
const DOT_BG = { correct:'#2e7d32', wrong:'#c62828', skipped:'#e65100', unattempted:'#90a4ae' }

const BM_KEY = 'tz_bookmarks_v1'
function loadBooks() { try { return JSON.parse(localStorage.getItem(BM_KEY)||'{}') } catch(e) { return {} } }
function saveBooks(b) { try { localStorage.setItem(BM_KEY, JSON.stringify(b)) } catch(e) {} }

function pct(a,b) { return b ? Math.round(a/b*100) : 0 }
function fmtTime(secs) {
  if (!secs && secs!==0) return '—'
  if (secs === 0) return '0s'
  const m = Math.floor(secs/60), s = secs%60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) } catch(e){return iso}
}

// ── Smart Analysis Engine ──────────────────────────────────────────────────
function analysePerformance(data, overall, subjects, getSubjQs, mCor, mNeg) {
  const insights = []
  const accuracy = pct(overall.cor, overall.cor+overall.wrg)
  const attemptRate = pct(overall.cor+overall.wrg+overall.skp, overall.total)
  const timePerQ = data.duration ? Math.round(data.duration / overall.total) : 0

  // Overall rating
  if (accuracy >= 80) insights.push({ type:'good', text:`Outstanding accuracy of ${accuracy}% — you're well prepared!` })
  else if (accuracy >= 60) insights.push({ type:'ok', text:`Good accuracy at ${accuracy}%. Focus on speed to attempt more.` })
  else if (accuracy >= 40) insights.push({ type:'warn', text:`Accuracy at ${accuracy}% needs improvement. Prioritise concepts over quantity.` })
  else insights.push({ type:'bad', text:`Low accuracy (${accuracy}%). Review fundamentals before attempting more mocks.` })

  // Attempt rate
  if (attemptRate < 70) insights.push({ type:'warn', text:`Only ${attemptRate}% questions attempted. In BITSAT every unattempted = 0, so attempt more.` })
  else if (attemptRate >= 95) insights.push({ type:'good', text:`Excellent attempt rate of ${attemptRate}%! Great time management.` })

  // Worst subject
  const subjScores = subjects.map(s => {
    const st = getSubjQs(s)
    const qs = Array.isArray(st) ? st : []
    const cor = qs.filter(q=>q.result==='correct').length
    const wrg = qs.filter(q=>q.result==='wrong').length
    return { s, acc: pct(cor, cor+wrg), total: qs.length, cor, wrg }
  }).filter(x => x.cor+x.wrg > 0)

  if (subjScores.length > 1) {
    const worst = subjScores.reduce((a,b) => a.acc < b.acc ? a : b)
    const best  = subjScores.reduce((a,b) => a.acc > b.acc ? a : b)
    insights.push({ type:'warn', text:`Weakest subject: ${worst.s} (${worst.acc}% accuracy). Dedicate extra revision time here.` })
    if (best.acc >= 70) insights.push({ type:'good', text:`Strongest subject: ${best.s} (${best.acc}% accuracy). Keep it up!` })
  }

  // Negative marking analysis
  const negMarks = overall.wrg * mNeg
  if (negMarks > 10) insights.push({ type:'warn', text:`Lost ${negMarks} marks from wrong answers. Consider skipping uncertain questions.` })

  // Time analysis
  if (timePerQ > 0) {
    if (timePerQ < 50) insights.push({ type:'good', text:`Fast pace: ~${timePerQ}s per question. Good time management for BITSAT.` })
    else if (timePerQ > 90) insights.push({ type:'warn', text:`Slow pace: ~${timePerQ}s/question. BITSAT needs ~54s/q. Practice speed.` })
  }

  return insights
}

export default function Analyser() {
  const [data, setData]         = useState(null)
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [drag, setDrag]         = useState(false)
  const [tab, setTab]           = useState('overview')
  const [activeSubj, setActiveSubj] = useState(null)
  const [filter, setFilter]     = useState('all')
  const [curQ, setCurQ]         = useState(0)
  const fileRef = useRef()
  const [books, setBooks]       = useState({})
  const [bmModal, setBmModal]   = useState(false)
  const [bmQ, setBmQ]           = useState(null)
  const [bmTarget, setBmTarget] = useState('')
  const [bmNewName, setBmNewName] = useState('')
  const [bmCreating, setBmCreating] = useState(false)
  const [bmDone, setBmDone]     = useState(false)

  useEffect(() => { setBooks(loadBooks()) }, [])

  const openBmModal = q => { setBmQ(q); setBmModal(true); setBmTarget(''); setBmNewName(''); setBmCreating(false); setBmDone(false) }
  const doBookmark = () => {
    const nb = bmCreating ? bmNewName.trim() : bmTarget
    if (!nb) return
    const b = loadBooks(); if (!b[nb]) b[nb] = []
    const already = b[nb].some(x => x.qnum===bmQ.qnum && x.testTitle===data.testTitle)
    if (!already) {
      b[nb].push({
        qnum:bmQ.qnum, subject:bmQ.subject, type:bmQ.type,
        text:bmQ.text||'', opts:bmQ.opts||[],
        correctAnswer:(bmQ.correctAnswer||bmQ.ans||'').toString().toUpperCase(),
        hasImage:!!(bmQ.images?.length||bmQ.hasImage),
        testTitle:data.testTitle,
        testPath:typeof window!=='undefined'?(new URLSearchParams(window.location.search).get('tp')?decodeURIComponent(new URLSearchParams(window.location.search).get('tp')):''):'',
        savedAt:Date.now()
      })
    }
    saveBooks(b); setBooks(b); setBmDone(true)
    setTimeout(()=>setBmModal(false), 800)
  }

  const processData = d => {
    if (!Array.isArray(d.questions)) throw new Error('No questions array found')
    d.questions = d.questions.map(q=>({
      ...q,
      result: q.result||(!q.yourAnswer?'unattempted':q.yourAnswer==='skip'?'skipped':
        String(q.correctAnswer||'').toUpperCase().trim()===String(q.yourAnswer||'').toUpperCase().trim()?'correct':'wrong')
    }))
    const first = SUBJ_ORDER.filter(s=>s!=='Bonus').find(s=>d.questions.some(q=>q.subject===s))||d.questions[0]?.subject
    setData(d); setActiveSubj(first); setCurQ(0); setFilter('all'); setTab('overview')
  }

  useEffect(()=>{
    if(typeof window==='undefined') return
    const params=new URLSearchParams(window.location.search)
    if(params.get('src')!=='auto') return
    setLoading(true)
    const run=async()=>{
      try{
        const stored=sessionStorage.getItem('tz_analyse')
        if(!stored||stored==='null'){setErr('No test data found. Please upload a result file.');setLoading(false);return}
        const meta=JSON.parse(stored)
        const tp=params.get('tp')?decodeURIComponent(params.get('tp')):''
        let questions
        if(tp&&!tp.startsWith('json_')){
          const r=await fetch(`/api/test/${tp}`)
          if(!r.ok) throw new Error(`Test not found (${r.status})`)
          const d=await r.json()
          questions=d.questions.map((q,i)=>{
            const st=meta.answers?.[i]
            const yourAns=st?.yourAnswer??null
            const correct=(q.ans||'').toUpperCase().trim()
            const yours=(yourAns||'').toUpperCase().trim()
            return{...q,yourAnswer:yourAns,correctAnswer:q.ans,
              result:!yourAns?'unattempted':yourAns==='skip'?'skipped':correct===yours?'correct':'wrong'}
          })
        } else {
          questions=meta.answers?.map((a,i)=>({
            qnum:i+1,subject:'Other',type:'MCQ',
            yourAnswer:a.yourAnswer,correctAnswer:a.correctAnswer,result:a.result
          }))||[]
        }
        processData({testTitle:meta.testTitle,subject:meta.subject,date:meta.date,
          score:meta.score,maxScore:meta.maxScore,accuracy:meta.accuracy,
          correct:meta.correct,wrong:meta.wrong,skipped:meta.skipped,unattempted:meta.unattempted,
          duration:meta.duration,marksCorrect:meta.marksCorrect,marksWrong:meta.marksWrong,
          subjStats:meta.subjStats,questions})
      }catch(e){setErr('Could not load: '+e.message)}
      setLoading(false)
    }; run()
  },[])

  const loadFile=async file=>{
    setErr('');setData(null)
    try{const d=JSON.parse(await file.text());processData(d)}catch(e){setErr('Invalid file: '+e.message)}
  }
  const handleDrop=e=>{e.preventDefault();setDrag(false);loadFile(e.dataTransfer.files[0])}

  // ── Upload screen ─────────────────────────────────────────────────────────
  if(!data) return(
    <>
      <Head><title>TestZyro — Analyser</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`${BASE_CSS}
        body{display:flex;flex-direction:column;min-height:100vh}
        .up-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px}
        .up-card{background:white;border-radius:24px;padding:48px 44px;width:100%;max-width:520px;box-shadow:0 8px 40px rgba(26,35,126,.12);text-align:center;border:1px solid #e8eaf6}
        .up-icon-wrap{width:80px;height:80px;background:linear-gradient(135deg,#1565c0,#6a1b9a);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 22px;color:white;box-shadow:0 8px 24px rgba(21,101,192,.3)}
        .up-h1{font-size:1.7rem;font-weight:900;color:#1a237e;letter-spacing:-.5px;margin-bottom:6px}
        .up-sub{font-size:.86rem;color:#6b7280;margin-bottom:28px}
        .up-drop{background:#f5f7ff;border:2.5px dashed #c5cae9;border-radius:16px;padding:36px 20px;cursor:pointer;transition:all .2s;margin-bottom:16px}
        .up-drop:hover,.up-drop.drag{border-color:#1565c0;background:#e8eaf6}
        .up-drop-icon{color:#9ca3af;margin-bottom:12px;display:flex;justify-content:center}
        .up-drop-title{font-size:.96rem;font-weight:700;color:#1a237e;margin-bottom:4px}
        .up-drop-sub{font-size:.78rem;color:#9ca3af;margin-bottom:16px}
        .up-browse{background:linear-gradient(135deg,#1565c0,#6a1b9a);color:white;border:none;padding:11px 28px;border-radius:9px;font-weight:700;font-size:.84rem;cursor:pointer;font-family:'Inter',sans-serif;box-shadow:0 4px 14px rgba(21,101,192,.3)}
        .up-err{background:#ffebee;border:1px solid #ef9a9a;color:#c62828;padding:10px 14px;border-radius:8px;font-size:.82rem;margin-top:12px;text-align:left}
        .up-steps{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;flex-wrap:wrap}
        .up-step{display:flex;align-items:center;gap:6px;font-size:.74rem;color:#6b7280}
        .up-sn{width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#1565c0,#6a1b9a);color:white;font-size:.62rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .up-arr{color:#d1d5db}
      `}</style>
      <Nav active="Analyser"/>
      <div className="up-wrap">
        <div className="up-card">
          <div className="up-icon-wrap">{Ic.chart}</div>
          <h1 className="up-h1">Test Analyser</h1>
          <p className="up-sub">Detailed subject-wise breakdown with smart performance insights</p>
          {loading ? <div style={{color:'#1565c0',fontWeight:600,padding:'20px 0'}}>Loading your test data…</div> : (
            <div className={`up-drop${drag?' drag':''}`}
              onDragOver={e=>{e.preventDefault();setDrag(true)}}
              onDragLeave={()=>setDrag(false)}
              onDrop={handleDrop}
              onClick={()=>fileRef.current.click()}>
              <div className="up-drop-icon">{Ic.upload}</div>
              <div className="up-drop-title">Drop result .json file here</div>
              <div className="up-drop-sub">Downloaded after submitting a test on TestZyro</div>
              <button className="up-browse" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>Browse File</button>
              <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={e=>{if(e.target.files[0])loadFile(e.target.files[0])}}/>
            </div>
          )}
          {err&&<div className="up-err">{err}</div>}
          <div className="up-steps">
            {[['1','Give a test'],['→'],['2','Download Output'],['→'],['3','Upload here ✓']].map((s,i)=>
              Array.isArray(s)?null:s==='→'?<span key={i} className="up-arr">→</span>:(
                <div key={i} className="up-step"><div className="up-sn">{s[0]}</div><span>{s[1]}</span></div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  )

  // ── Computed ──────────────────────────────────────────────────────────────
  const allQs    = data.questions
  const subjects = SUBJ_ORDER.filter(s=>allQs.some(q=>q.subject===s))
  const getSubjQsArr = s => allQs.filter(q=>q.subject===s)
  const ms = qs=>({ total:qs.length, cor:qs.filter(q=>q.result==='correct').length, wrg:qs.filter(q=>q.result==='wrong').length, skp:qs.filter(q=>q.result==='skipped').length, un:qs.filter(q=>q.result==='unattempted').length })
  const overall  = ms(allQs)
  const mCor     = data.marksCorrect||3, mNeg = data.marksWrong||1
  const accuracy = pct(overall.cor, overall.cor+overall.wrg)
  const attempted= overall.cor+overall.wrg+overall.skp
  const score    = data.score ?? (overall.cor*mCor - overall.wrg*mNeg)
  const maxScore = data.maxScore ?? (overall.total*mCor)
  const scoreColor = score >= maxScore*0.6 ? '#2e7d32' : score >= maxScore*0.35 ? '#e65100' : '#c62828'
  const timePerQ = data.duration && overall.total ? Math.round(data.duration/overall.total) : 0

  // Smart insights
  const insights = analysePerformance(data, overall, subjects, getSubjQsArr, mCor, mNeg)

  // Review tab
  const subjQs    = activeSubj ? allQs.filter(q=>q.subject===activeSubj) : allQs
  const filteredQs= filter==='all' ? subjQs : subjQs.filter(q=>q.result===filter)
  const curQ2     = filteredQs[curQ]||null
  const switchSubj= s=>{setActiveSubj(s);setCurQ(0);setFilter('all')}
  const openReview= s=>{switchSubj(s);setTab('review')}

  const getRating = p => p>=90?['Outstanding','#2e7d32']:p>=75?['Excellent','#1565c0']:p>=60?['Good','#e65100']:p>=40?['Average','#ef6c00']:['Needs Work','#c62828']
  const [ratingLabel, ratingColor] = getRating(accuracy)

  return(
    <>
      <Head><title>Analyser — {data.testTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`${BASE_CSS}${APP_CSS}`}</style>
      <Nav active="Analyser"/>

      {/* Analyser sub-header */}
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <span className="sub-test-name">{data.testTitle}</span>
          {data.date&&<span className="sub-date">{fmtDate(data.date)}</span>}
        </div>
        <div className="sub-tabs">
          {['overview','review'].map(t=>(
            <button key={t} className={`sub-tab${tab===t?' on':''}`} onClick={()=>setTab(t)}>
              {t==='overview'?<>{Ic.chart} Overview</>:<>{Ic.target} Review</>}
            </button>
          ))}
        </div>
        <button className="sub-newfile" onClick={()=>setData(null)}>↩ New File</button>
      </div>

      {/* ── Bookmark Modal ── */}
      {bmModal&&(
        <div className="bm-ov" onClick={e=>{if(e.currentTarget===e.target)setBmModal(false)}}>
          <div className="bm-box">
            {bmDone?<div className="bm-done">Bookmarked!</div>:(
              <>
                <div className="bm-ttl">Save to Notebook</div>
                {Object.keys(books).length>0&&!bmCreating&&(
                  <div className="bm-list">
                    {Object.keys(books).map(nb=>(
                      <div key={nb} className={`bm-item${bmTarget===nb?' sel':''}`} onClick={()=>setBmTarget(nb)}>
                        <span>{nb}</span><span className="bm-cnt">{books[nb].length} qs</span>
                      </div>
                    ))}
                  </div>
                )}
                {!bmCreating
                  ?<button className="bm-new" onClick={()=>setBmCreating(true)}>+ New notebook</button>
                  :<input className="bm-inp" autoFocus placeholder="Notebook name…" value={bmNewName} onChange={e=>setBmNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doBookmark()}/>
                }
                <div className="bm-acts">
                  <button className="bm-save" onClick={doBookmark} disabled={bmCreating?!bmNewName.trim():!bmTarget}>Save</button>
                  <button className="bm-cancel" onClick={()=>setBmModal(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {tab==='overview'&&(
        <div className="ov-page">

          {/* Score hero */}
          <div className="hero">
            <div className="hero-score-col">
              <div className="hero-label">Total Score</div>
              <div className="hero-score" style={{color:scoreColor}}>{score}<span className="hero-max">/{maxScore}</span></div>
              <div className="hero-rating" style={{color:ratingColor}}>{ratingLabel}</div>
              <div className="hero-chips">
                <div className="hchip">{Ic.clock} {fmtTime(data.duration)}</div>
                <div className="hchip">{Ic.target} {accuracy}% accuracy</div>
                <div className="hchip">{Ic.chart} {attempted}/{overall.total} attempted</div>
                {timePerQ>0&&<div className="hchip">{Ic.clock} {fmtTime(timePerQ)}/question</div>}
              </div>
            </div>
            <div className="hero-stats">
              {[
                {n:overall.cor,  l:'Correct',       c:'#2e7d32', bg:'#e8f5e9', ic:Ic.correct},
                {n:overall.wrg,  l:'Wrong',          c:'#c62828', bg:'#ffebee', ic:Ic.wrong},
                {n:overall.skp,  l:'Skipped',        c:'#e65100', bg:'#fff3e0', ic:Ic.skip},
                {n:overall.un,   l:'Not Attempted',  c:'#546e7a', bg:'#eceff1', ic:Ic.na},
              ].map(({n,l,c,bg,ic})=>(
                <div key={l} className="hstat" style={{background:bg}}>
                  <div className="hstat-ic" style={{color:c}}>{ic}</div>
                  <div className="hstat-n" style={{color:c}}>{n}</div>
                  <div className="hstat-l">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Smart Insights */}
          {insights.length>0&&(
            <div className="insights-card">
              <div className="ic-title">{Ic.bolt} Smart Insights</div>
              <div className="ic-list">
                {insights.map((ins,i)=>(
                  <div key={i} className={`insight ins-${ins.type}`}>
                    <div className="ins-dot"/>
                    <span>{ins.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject cards */}
          <div className="sec-title">{Ic.chart} Subject Performance</div>
          <div className="scard-grid">
            {subjects.map(s=>{
              const sc=getSC(s), qs=getSubjQsArr(s), st=ms(qs)
              const sp=pct(st.cor,st.cor+st.wrg)
              const subScore=st.cor*mCor-st.wrg*mNeg
              const subjTime = data.duration && allQs.length ? Math.round(data.duration/allQs.length*st.total) : 0
              return(
                <div key={s} className="scard" onClick={()=>openReview(s)}>
                  <div className="scard-top" style={{background:sc.grd}}>
                    <div>
                      <div className="scard-lbl">{sc.label}</div>
                      <div className="scard-name">{s}</div>
                    </div>
                    <div className="scard-score" style={{color:'rgba(255,255,255,.9)'}}>
                      {subScore>=0?'+':''}{subScore}
                    </div>
                  </div>
                  <div className="scard-body">
                    <div className="scard-bar-row">
                      <span>Accuracy</span><span style={{fontWeight:700,color:sc.bg}}>{sp}%</span>
                    </div>
                    <div className="scard-track"><div style={{width:sp+'%',height:'100%',background:sc.grd,borderRadius:99}}/></div>
                    <div className="scard-stats4">
                      <div className="ss"><span style={{color:'#2e7d32',fontWeight:800}}>{st.cor}</span><span>Correct</span></div>
                      <div className="ss"><span style={{color:'#c62828',fontWeight:800}}>{st.wrg}</span><span>Wrong</span></div>
                      <div className="ss"><span style={{color:'#e65100',fontWeight:800}}>{st.skp}</span><span>Skip</span></div>
                      <div className="ss"><span style={{color:'#90a4ae',fontWeight:800}}>{st.un}</span><span>NA</span></div>
                    </div>
                    <div className="scard-meta">
                      {subjTime>0&&<span>{Ic.clock} {fmtTime(subjTime)}</span>}
                      {st.total>0&&<span>{Ic.clock} {fmtTime(data.duration&&allQs.length?Math.round(data.duration/allQs.length):0)}/q</span>}
                    </div>
                    <button className="scard-btn">Review Questions →</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Breakdown table */}
          <div className="sec-title">{Ic.chart} Detailed Breakdown</div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th>Subject</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Not Att.</th><th>Attempted</th><th>Accuracy</th><th>Est. Time</th><th>Per Q</th>
              </tr></thead>
              <tbody>
                {subjects.map(s=>{
                  const sc=getSC(s), qs=getSubjQsArr(s), st=ms(qs)
                  const sp=pct(st.cor,st.cor+st.wrg)
                  const subScore=st.cor*mCor-st.wrg*mNeg
                  const att=st.cor+st.wrg+st.skp
                  const subjTime=data.duration&&allQs.length?Math.round(data.duration/allQs.length*st.total):0
                  const perQ=data.duration&&allQs.length?Math.round(data.duration/allQs.length):0
                  return(<tr key={s} className="trow" onClick={()=>openReview(s)}>
                    <td><div className="td-s"><div style={{width:8,height:8,borderRadius:'50%',background:sc.bg,flexShrink:0}}/><span className="tdbadge" style={{background:sc.light,color:sc.bg}}>{sc.label}</span>{s}</div></td>
                    <td><b style={{color:subScore>=0?'#2e7d32':'#c62828'}}>{subScore>=0?'+':''}{subScore}</b></td>
                    <td style={{color:'#2e7d32',fontWeight:700}}>{st.cor}</td>
                    <td style={{color:'#c62828',fontWeight:700}}>{st.wrg}</td>
                    <td style={{color:'#e65100',fontWeight:700}}>{st.skp}</td>
                    <td style={{color:'#90a4ae',fontWeight:700}}>{st.un}</td>
                    <td style={{fontFamily:'JetBrains Mono,monospace'}}>{att}/{st.total}</td>
                    <td><div className="td-acc"><div className="td-bar"><div style={{width:sp+'%',height:'100%',background:sc.grd,borderRadius:99}}/></div><b style={{color:sc.bg}}>{sp}%</b></div></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:'.75rem',color:'#6b7280'}}>{fmtTime(subjTime)}</td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:'.75rem',color:'#6b7280'}}>{fmtTime(perQ)}</td>
                  </tr>)
                })}
                <tr className="trow-total">
                  <td><div className="td-s"><b>Total</b></div></td>
                  <td><b style={{color:scoreColor,fontSize:'.95rem'}}>{score}</b></td>
                  <td style={{color:'#2e7d32',fontWeight:800}}>{overall.cor}</td>
                  <td style={{color:'#c62828',fontWeight:800}}>{overall.wrg}</td>
                  <td style={{color:'#e65100',fontWeight:800}}>{overall.skp}</td>
                  <td style={{color:'#90a4ae',fontWeight:800}}>{overall.un}</td>
                  <td style={{fontFamily:'JetBrains Mono,monospace'}}>{attempted}/{overall.total}</td>
                  <td><div className="td-acc"><div className="td-bar"><div style={{width:accuracy+'%',height:'100%',background:'linear-gradient(90deg,#1565c0,#6a1b9a)',borderRadius:99}}/></div><b style={{color:'#1565c0'}}>{accuracy}%</b></div></td>
                  <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:'.75rem',color:'#6b7280'}}>{fmtTime(data.duration)}</td>
                  <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:'.75rem',color:'#6b7280'}}>{fmtTime(timePerQ)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Marking scheme */}
          <div className="scheme">
            <span style={{color:'#2e7d32',fontWeight:700}}>+{mCor} Correct</span>
            <span style={{color:'#c62828',fontWeight:700}}>−{mNeg} Wrong</span>
            <span style={{color:'#6b7280'}}>0 Skipped/NA</span>
          </div>

        </div>
      )}

      {/* ══ REVIEW ════════════════════════════════════════════════════════════ */}
      {tab==='review'&&(
        <div className="rev-shell">
          {/* Subject bar */}
          <div className="rev-sbar">
            {subjects.map(s=>{
              const sc=getSC(s), st=ms(getSubjQsArr(s)), isA=activeSubj===s
              return(
                <button key={s} className={`rsb${isA?' on':''}`}
                  style={isA?{background:sc.grd,color:'white',borderColor:'transparent'}:{color:sc.bg,borderColor:sc.bg+'44'}}
                  onClick={()=>switchSubj(s)}>
                  <span className="rsb-lbl">{sc.label}</span>
                  <span className="rsb-name">{s}</span>
                  <span className="rsb-cnt" style={isA?{background:'rgba(255,255,255,.22)'}:{background:sc.light,color:sc.bg}}>{st.cor}/{st.total}</span>
                </button>
              )
            })}
          </div>

          <div className="rev-body">
            {/* Left nav */}
            <div className="rev-nav">
              <div className="rn-hdr">Questions <span style={{color:'#1565c0',fontWeight:500}}>{filteredQs.length}/{subjQs.length}</span></div>
              <div className="rn-filters">
                {[['all','All'],['correct','Correct'],['wrong','Wrong'],['skipped','Skipped'],['unattempted','Not Att.']].map(([m,l])=>(
                  <button key={m} className={`rf${filter===m?' on':''}`}
                    style={filter===m?{background:m==='all'?'#1a237e':DOT_BG[m]||'#1a237e',color:'white',borderColor:'transparent'}:{}}
                    onClick={()=>{setFilter(m);setCurQ(0)}}>{l}</button>
                ))}
              </div>
              <div className="rn-dots">
                {filteredQs.map((q,i)=>(
                  <div key={i} title={`Q${q.qnum||i+1}`}
                    className={`rn-dot${i===curQ?' cur':''}`}
                    style={{background:i===curQ?'#1a237e':DOT_BG[q.result],boxShadow:i===curQ?'0 0 0 2px white,0 0 0 4px #1a237e':''}}
                    onClick={()=>setCurQ(i)}>{q.qnum||(subjQs.indexOf(q)+1)}</div>
                ))}
                {!filteredQs.length&&<div style={{color:'#9ca3af',fontSize:'.72rem',gridColumn:'1/-1',textAlign:'center',paddingTop:16}}>No questions</div>}
              </div>
              <div className="rn-legend">
                {Object.entries(DOT_BG).map(([k,c])=>(
                  <div key={k} className="rn-leg"><div style={{width:10,height:10,borderRadius:3,background:c,flexShrink:0}}/><span>{RES[k]?.label}</span></div>
                ))}
              </div>
            </div>

            {/* Question panel */}
            <div className="rev-qpanel">
              {!curQ2?(
                <div className="rq-empty">Select a question from the left panel</div>
              ):(
                <>
                  <div className="rq-hdr">
                    <div className="rq-hl">
                      <span className="rq-num">Q{curQ2.qnum||(subjQs.indexOf(curQ2)+1)}</span>
                      {curQ2.subject&&(()=>{const sc=getSC(curQ2.subject);return(
                        <span className="rq-subj" style={{background:sc.light,color:sc.bg,border:`1px solid ${sc.dot}55`}}>{sc.label} · {curQ2.subject}</span>
                      )})()}
                      <span className={`rq-type ${curQ2.type==='INTEGER'?'int':'mcq'}`}>{curQ2.type==='INTEGER'?'Integer':'MCQ'}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button className="rq-bm" onClick={()=>openBmModal(curQ2)} title="Bookmark this question">{Ic.bookmark}</button>
                      <span className="rq-badge" style={{background:RES[curQ2.result]?.bg,color:RES[curQ2.result]?.color,border:`1px solid ${RES[curQ2.result]?.border}`}}>
                        {curQ2.result==='correct'?Ic.correct:curQ2.result==='wrong'?Ic.wrong:curQ2.result==='skipped'?Ic.skip:Ic.na}
                        {RES[curQ2.result]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Content — image always first, then options */}
                  <div className="rq-body">
                    {curQ2.images?.length>0&&(
                      <div className="rq-imgs">{curQ2.images.map((img,i)=><img key={i} src={`data:image/png;base64,${img}`} alt="" style={{maxWidth:'100%',display:'block',margin:'0 auto 8px',borderRadius:8}}/>)}</div>
                    )}
                    {!curQ2.images?.length&&curQ2.text&&(
                      <div className="rq-text" dangerouslySetInnerHTML={{__html:(curQ2.text||'').replace(/\n/g,'<br/>')}}/>
                    )}
                  </div>

                  {/* Options always show below - even for image questions so user can see their answer */}
                  {curQ2.type==='MCQ'&&(
                    <div className="rq-opts">
                      {['A','B','C','D'].map((lbl,i)=>{
                        const isCor=lbl===(curQ2.correctAnswer||'').toUpperCase().trim()
                        const isYrs=lbl===(curQ2.yourAnswer||'').toUpperCase().trim()
                        const hasText = curQ2.opts?.[i] && curQ2.opts[i].length > 1
                        return(
                          <div key={lbl} className={`rq-opt${isCor?' cor':isYrs&&!isCor?' wrg':''}`}>
                            <div className="rq-lbl">{lbl}</div>
                            {hasText && <div className="rq-otext">{curQ2.opts[i]}</div>}
                            <div className="rq-tags" style={{marginLeft:'auto'}}>
                              {isCor&&isYrs&&<span className="rqt green">{Ic.correct} Your Ans · Correct</span>}
                              {isCor&&!isYrs&&<span className="rqt green">{Ic.correct} Correct</span>}
                              {isYrs&&!isCor&&<span className="rqt red">{Ic.wrong} Your Ans</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {curQ2.type==='INTEGER'&&(
                    <div className="rq-int">
                      <div className="rq-int-row"><span>Your Answer</span><b style={{color:curQ2.result==='correct'?'#2e7d32':'#c62828',background:curQ2.result==='correct'?'#e8f5e9':'#ffebee',padding:'4px 16px',borderRadius:7}}>{curQ2.yourAnswer||'—'}</b></div>
                      <div className="rq-int-row"><span>Correct Answer</span><b style={{color:'#2e7d32',background:'#e8f5e9',padding:'4px 16px',borderRadius:7}}>{curQ2.correctAnswer}</b></div>
                    </div>
                  )}

                  <div className="rq-nav">
                    <button className="rqn" disabled={curQ===0} onClick={()=>setCurQ(c=>c-1)}>← Prev</button>
                    <span className="rqn-cnt">{curQ+1} / {filteredQs.length}</span>
                    <button className="rqn primary" disabled={curQ>=filteredQs.length-1} onClick={()=>setCurQ(c=>c+1)}>Next →</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f0f4ff;color:#1a1a2e;font-family:'Inter',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#c5cae9;border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
`

const APP_CSS = `
/* Sub header */
.sub-hdr{background:white;border-bottom:1px solid #e0e4ff;padding:0 24px;height:48px;display:flex;align-items:center;gap:16px;position:sticky;top:56px;z-index:90}
.sub-hdr-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.sub-test-name{font-weight:700;font-size:.88rem;color:#1a237e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub-date{font-size:.7rem;color:#9ca3af;font-family:'JetBrains Mono',monospace;flex-shrink:0}
.sub-tabs{display:flex;gap:4px;flex-shrink:0}
.sub-tab{display:flex;align-items:center;gap:6px;padding:6px 16px;border-radius:7px;border:1.5px solid #e0e4ff;background:white;color:#6b7280;font-family:'Inter',sans-serif;font-weight:600;font-size:.8rem;cursor:pointer;transition:all .15s}
.sub-tab:hover{border-color:#1a237e;color:#1a237e}
.sub-tab.on{background:#1a237e;color:white;border-color:#1a237e}
.sub-newfile{margin-left:auto;background:white;border:1.5px solid #e0e4ff;color:#6b7280;padding:6px 14px;border-radius:7px;font-family:'Inter',sans-serif;font-size:.78rem;cursor:pointer;flex-shrink:0}
.sub-newfile:hover{border-color:#1a237e;color:#1a237e}
/* Page */
.ov-page{max-width:1120px;margin:0 auto;padding:24px 18px 80px;animation:fadeIn .3s ease}
.sec-title{display:flex;align-items:center;gap:8px;font-size:.65rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:2.5px;margin-bottom:14px;font-family:'JetBrains Mono',monospace}
.sec-title::after{content:'';flex:1;height:1px;background:#e0e4ff}
/* Hero */
.hero{background:white;border:1px solid #e0e4ff;border-radius:18px;padding:28px 32px;display:flex;gap:28px;align-items:flex-start;margin-bottom:24px;box-shadow:0 2px 16px rgba(26,35,126,.06);flex-wrap:wrap}
.hero-score-col{flex:1;min-width:200px}
.hero-label{font-size:.62rem;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;font-family:'JetBrains Mono',monospace}
.hero-score{font-family:'JetBrains Mono',monospace;font-size:3.6rem;font-weight:900;letter-spacing:-2px;line-height:1}
.hero-max{font-size:1.1rem;color:#9ca3af;font-weight:400}
.hero-rating{font-size:.88rem;font-weight:800;margin:8px 0 14px}
.hero-chips{display:flex;gap:7px;flex-wrap:wrap}
.hchip{display:flex;align-items:center;gap:5px;font-size:.7rem;background:#f0f4ff;color:#3949ab;border:1px solid #c5cae9;padding:4px 11px;border-radius:20px;font-weight:600}
.hero-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;flex-shrink:0}
.hstat{border-radius:14px;padding:16px;text-align:center;min-width:96px}
.hstat-ic{display:flex;justify-content:center;margin-bottom:6px}
.hstat-n{font-family:'JetBrains Mono',monospace;font-size:1.9rem;font-weight:900;line-height:1;margin-bottom:4px}
.hstat-l{font-size:.6rem;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}
/* Insights */
.insights-card{background:white;border:1px solid #e0e4ff;border-radius:14px;padding:18px 20px;margin-bottom:24px}
.ic-title{display:flex;align-items:center;gap:7px;font-size:.72rem;font-weight:800;color:#1a237e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;font-family:'JetBrains Mono',monospace}
.ic-list{display:flex;flex-direction:column;gap:8px}
.insight{display:flex;align-items:flex-start;gap:10px;font-size:.82rem;padding:8px 12px;border-radius:8px;line-height:1.5}
.ins-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:5px}
.ins-good{background:#e8f5e9;color:#2e7d32}.ins-good .ins-dot{background:#2e7d32}
.ins-ok{background:#e3f2fd;color:#1565c0}.ins-ok .ins-dot{background:#1565c0}
.ins-warn{background:#fff8e1;color:#e65100}.ins-warn .ins-dot{background:#e65100}
.ins-bad{background:#ffebee;color:#c62828}.ins-bad .ins-dot{background:#c62828}
/* Subject cards */
.scard-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-bottom:28px}
.scard{background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);cursor:pointer;transition:all .2s;border:1px solid #e8eaf6}
.scard:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,.11)}
.scard-top{padding:16px 18px;display:flex;align-items:center;justify-content:space-between}
.scard-lbl{font-size:.6rem;font-weight:800;color:rgba(255,255,255,.75);font-family:'JetBrains Mono',monospace;letter-spacing:.5px;margin-bottom:2px}
.scard-name{font-size:.85rem;font-weight:700;color:white}
.scard-score{font-family:'JetBrains Mono',monospace;font-size:1.4rem;font-weight:900}
.scard-body{padding:14px 16px 16px}
.scard-bar-row{display:flex;justify-content:space-between;font-size:.72rem;color:#6b7280;margin-bottom:5px}
.scard-track{height:5px;background:#f0f0f0;border-radius:99px;overflow:hidden;margin-bottom:12px}
.scard-stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:10px}
.ss{display:flex;flex-direction:column;align-items:center;gap:2px}
.ss span:first-child{font-family:'JetBrains Mono',monospace;font-size:.95rem}
.ss span:last-child{font-size:.55rem;color:#9ca3af;text-transform:uppercase}
.scard-meta{display:flex;gap:8px;font-size:.64rem;color:#9ca3af;margin-bottom:10px;flex-wrap:wrap}
.scard-meta span{display:flex;align-items:center;gap:3px}
.scard-btn{width:100%;padding:8px;background:#f0f4ff;color:#1565c0;border:1.5px solid #c5cae9;border-radius:7px;font-family:'Inter',sans-serif;font-weight:600;font-size:.76rem;cursor:pointer;transition:all .15s}
.scard-btn:hover{background:#e8eaf6;border-color:#1565c0}
/* Table */
.tbl-wrap{background:white;border-radius:14px;overflow:hidden;border:1px solid #e0e4ff;margin-bottom:16px;overflow-x:auto;box-shadow:0 2px 10px rgba(0,0,0,.05)}
.tbl{width:100%;border-collapse:collapse;font-size:.8rem}
.tbl thead tr{background:#1a237e}
.tbl th{padding:11px 13px;text-align:left;font-size:.6rem;font-weight:800;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.8px;white-space:nowrap}
.trow{border-bottom:1px solid #f0f0f0;transition:background .12s;cursor:pointer}
.trow:hover{background:#f5f7ff}
.trow-total{background:#f5f7ff;border-top:2px solid #c5cae9}
.tbl td{padding:11px 13px;vertical-align:middle}
.td-s{display:flex;align-items:center;gap:7px;font-weight:600}
.tdbadge{font-size:.58rem;font-weight:800;padding:2px 6px;border-radius:8px;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.td-acc{display:flex;align-items:center;gap:7px}
.td-bar{width:54px;height:4px;background:#e8eaf6;border-radius:99px;overflow:hidden;flex-shrink:0}
/* Scheme */
.scheme{display:flex;gap:14px;font-size:.78rem;padding:10px 16px;background:white;border-radius:10px;border:1px solid #e0e4ff;margin-top:8px;flex-wrap:wrap}
/* Review */
.rev-shell{display:flex;flex-direction:column;height:calc(100vh - 104px)}
.rev-sbar{background:#f8f9ff;border-bottom:1px solid #e0e4ff;padding:8px 14px;display:flex;gap:5px;overflow-x:auto;flex-shrink:0}
.rsb{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9px;border:1.5px solid;background:transparent;cursor:pointer;font-family:'Inter',sans-serif;font-size:.78rem;font-weight:600;white-space:nowrap;transition:all .18s;flex-shrink:0}
.rsb-lbl{font-family:'JetBrains Mono',monospace;font-size:.6rem;font-weight:800}
.rsb-cnt{font-family:'JetBrains Mono',monospace;font-size:.6rem;font-weight:700;padding:2px 7px;border-radius:20px}
.rev-body{display:flex;flex:1;overflow:hidden;min-height:0}
.rev-nav{width:210px;flex-shrink:0;background:white;border-right:1px solid #e0e4ff;display:flex;flex-direction:column;overflow:hidden}
.rn-hdr{padding:10px 12px;font-size:.6rem;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #e0e4ff;display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace}
.rn-filters{padding:8px;display:flex;flex-direction:column;gap:3px;border-bottom:1px solid #e0e4ff}
.rf{padding:6px 10px;border-radius:6px;font-size:.73rem;font-weight:600;cursor:pointer;border:1.5px solid #e0e4ff;background:transparent;color:#6b7280;font-family:'Inter',sans-serif;text-align:left;transition:all .12s}
.rf:hover{background:#f5f7ff;border-color:#c5cae9;color:#1a237e}
.rn-dots{padding:8px;display:grid;grid-template-columns:repeat(5,1fr);gap:3px;overflow-y:auto;flex:1}
.rn-dot{height:27px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:.55rem;font-weight:800;cursor:pointer;color:white;transition:all .1s}
.rn-dot:hover{transform:scale(1.1)}
.rn-dot.cur{border-radius:6px}
.rn-legend{padding:8px 10px;border-top:1px solid #e0e4ff}
.rn-leg{display:flex;align-items:center;gap:5px;font-size:.62rem;color:#9ca3af;margin-bottom:4px}
/* Q panel */
.rev-qpanel{flex:1;background:white;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:13px}
.rq-empty{color:#9ca3af;font-size:.86rem;text-align:center;margin-top:60px}
.rq-hdr{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.rq-hl{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.rq-num{font-family:'JetBrains Mono',monospace;font-size:.78rem;font-weight:700;background:#e8eaf6;border:1.5px solid #c5cae9;color:#1a237e;padding:4px 11px;border-radius:7px}
.rq-subj{font-size:.68rem;font-weight:700;padding:4px 10px;border-radius:20px;font-family:'JetBrains Mono',monospace}
.rq-type{font-size:.6rem;font-weight:800;padding:3px 8px;border-radius:20px;font-family:'JetBrains Mono',monospace}
.rq-type.mcq{background:#e3f2fd;color:#1565c0;border:1px solid #90caf9}
.rq-type.int{background:#fff8e1;color:#e65100;border:1px solid #ffe082}
.rq-bm{background:#fff8e1;border:1px solid #ffe082;color:#e65100;padding:6px 10px;border-radius:6px;cursor:pointer;display:flex;align-items:center}
.rq-bm:hover{background:#fef3c7}
.rq-badge{display:flex;align-items:center;gap:5px;font-size:.74rem;font-weight:700;padding:5px 12px;border-radius:20px}
.rq-body{background:#f8f9ff;border:1px solid #e8eaf6;border-radius:12px;padding:16px;min-height:60px}
.rq-imgs{text-align:center}
.rq-text{font-size:.9rem;line-height:1.9;color:#1a1a2e;white-space:pre-wrap}
.rq-opts{display:flex;flex-direction:column;gap:8px}
.rq-opt{display:flex;align-items:flex-start;gap:10px;border:1.5px solid #e0e4ff;border-radius:10px;padding:11px 13px;background:white;transition:all .12s}
.rq-opt.cor{border-color:#2e7d32!important;background:#e8f5e9!important}
.rq-opt.wrg{border-color:#c62828!important;background:#ffebee!important}
.rq-lbl{width:27px;height:27px;border-radius:7px;background:#e8eaf6;border:1.5px solid #c5cae9;color:#1a237e;font-family:'JetBrains Mono',monospace;font-size:.7rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rq-opt.cor .rq-lbl{background:#2e7d32;border-color:#2e7d32;color:white}
.rq-opt.wrg .rq-lbl{background:#c62828;border-color:#c62828;color:white}
.rq-otext{flex:1;font-size:.88rem;color:#1a1a2e;line-height:1.6;padding-top:2px}
.rq-tags{display:flex;flex-direction:column;gap:3px;align-items:flex-end;flex-shrink:0;padding-top:2px}
.rqt{display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:700;padding:2px 8px;border-radius:8px;white-space:nowrap}
.rqt.green{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
.rqt.red{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.rq-int{background:#f8f9ff;border-radius:10px;overflow:hidden;border:1px solid #e0e4ff}
.rq-int-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #eee;font-size:.82rem;color:#6b7280}
.rq-int-row:last-child{border-bottom:none}
.rq-nav{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f0f0f0;padding-top:12px;margin-top:auto}
.rqn{padding:9px 22px;border-radius:8px;border:1.5px solid #e0e4ff;background:white;color:#1a237e;font-family:'Inter',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer;transition:all .15s}
.rqn:hover:not(:disabled){background:#e8eaf6;border-color:#1a237e}
.rqn.primary{background:#1a237e;color:white;border-color:#1a237e}
.rqn.primary:hover:not(:disabled){background:#283593}
.rqn:disabled{opacity:.3;cursor:not-allowed}
.rqn-cnt{font-family:'JetBrains Mono',monospace;font-size:.82rem;color:#6b7280;font-weight:700}
/* Bookmark modal */
.bm-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)}
.bm-box{background:white;border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.bm-done{text-align:center;font-weight:700;color:#2e7d32;padding:8px 0;font-size:1.05rem}
.bm-ttl{font-weight:800;font-size:.92rem;color:#1a237e;margin-bottom:14px}
.bm-list{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;max-height:180px;overflow-y:auto}
.bm-item{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border:1.5px solid #e0e4ff;border-radius:8px;cursor:pointer;transition:all .12s;font-size:.84rem}
.bm-item:hover{border-color:#1a237e;background:#f5f7ff}
.bm-item.sel{border-color:#1a237e;background:#e8eaf6;font-weight:700}
.bm-cnt{font-size:.65rem;color:#9ca3af;font-family:'JetBrains Mono',monospace}
.bm-new{background:none;border:1.5px dashed #c5cae9;color:#1a237e;padding:8px;border-radius:8px;width:100%;font-size:.8rem;font-weight:600;cursor:pointer;margin-bottom:12px;font-family:'Inter',sans-serif}
.bm-inp{width:100%;border:1.5px solid #c5cae9;border-radius:8px;padding:9px 12px;font-size:.84rem;outline:none;font-family:'Inter',sans-serif;margin-bottom:12px;display:block}
.bm-inp:focus{border-color:#1a237e}
.bm-acts{display:flex;gap:8px}
.bm-save{flex:1;background:#1a237e;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;font-size:.84rem;cursor:pointer;font-family:'Inter',sans-serif}
.bm-save:disabled{background:#9e9e9e;cursor:not-allowed}
.bm-cancel{padding:10px 16px;border-radius:8px;border:1px solid #e0e0e0;background:white;font-size:.84rem;cursor:pointer;font-family:'Inter',sans-serif}
@media(max-width:768px){
  .hero{flex-direction:column}.hero-stats{width:100%;grid-template-columns:repeat(4,1fr)}
  .rev-body{flex-direction:column}.rev-nav{width:100%;max-height:200px;border-right:none;border-bottom:1px solid #e0e4ff}
  .rn-dots{grid-template-columns:repeat(8,1fr)}
  .sub-hdr{flex-wrap:wrap;height:auto;padding:8px 14px;gap:8px;top:56px}
}
`
