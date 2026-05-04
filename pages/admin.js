import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'

const ADM_KEY = 'tz_adm_tok'
const SUBJ_ORDER = ['Physics','Chemistry','English & LR','Mathematics','Maths','Biology']
const OPT_MAP = {'1':'A','2':'B','3':'C','4':'D'}

// Normalize subject names so the CBT navigator works correctly
const SUBJ_NORMALIZE = {
  'Mathematics': 'Maths',
  'Math':        'Maths',
  'English':     'English & LR',
  'English & Logical Reasoning': 'English & LR',
}
const normalizeSubj = s => SUBJ_NORMALIZE[s] || s

// Preferred display order in CBT
const DISPLAY_ORDER = ['Physics','Chemistry','Maths','English & LR']

// Load JSZip from CDN
async function loadJSZip() {
  if (window.JSZip) return window.JSZip
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    s.onload = () => res(window.JSZip)
    s.onerror = () => rej(new Error('Failed to load JSZip'))
    document.head.appendChild(s)
  })
}

// Process BITSAT zip entirely in browser
async function processBitsatZip(file, testName, onProgress) {
  const JSZip = await loadJSZip()
  onProgress('Reading zip file...')
  const zip = await JSZip.loadAsync(file)

  // Find data.json (may be at root or in subfolder)
  let dataFile = zip.file('data.json')
  if (!dataFile) {
    // look inside subfolder
    zip.forEach((path, f) => { if (path.endsWith('data.json') && !dataFile) dataFile = f })
  }
  if (!dataFile) throw new Error('data.json not found in zip')

  onProgress('Parsing question data...')
  const dataText = await dataFile.async('text')
  let data
  try { data = JSON.parse(dataText) }
  catch(e) { throw new Error('data.json is not valid JSON: ' + e.message) }

  const pcd = data.pdfCropperData
  const ak  = data.testAnswerKey
  if (!pcd || !ak) throw new Error('Missing pdfCropperData or testAnswerKey in data.json')

  // Build image map: "Subject__--__qnum__--__idx" -> base64
  onProgress('Loading question images...')
  const imageMap = {}
  const imgPromises = []
  zip.forEach((relPath, zipEntry) => {
    const filename = relPath.split('/').pop()
    if (!/\.(png|jpg|jpeg)$/i.test(filename)) return
    const key = filename.replace(/\.(png|jpg|jpeg)$/i, '')
    imgPromises.push(
      zipEntry.async('base64').then(b64 => { imageMap[key] = b64 })
    )
  })
  await Promise.all(imgPromises)

  onProgress(`Processing ${Object.keys(imageMap).length} images...`)

  const questions = []
  // Fix subject order: Physics → Chemistry → English & LR → Maths → Biology → others → Bonus
  const pcdSubjects = Object.keys(pcd)
  const finalOrder = [
    ...pcdSubjects.filter(s => s === 'Physics'),
    ...pcdSubjects.filter(s => s === 'Chemistry'),
    ...pcdSubjects.filter(s => ['English & LR','English','English & Logical Reasoning'].includes(s)),
    ...pcdSubjects.filter(s => ['Maths','Mathematics','Math'].includes(s)),
    ...pcdSubjects.filter(s => s === 'Biology'),
    ...pcdSubjects.filter(s => !['Physics','Chemistry','English & LR','English','English & Logical Reasoning','Maths','Mathematics','Math','Biology','Bonus'].includes(s)),
    ...pcdSubjects.filter(s => s === 'Bonus'),
  ]

  for (const subj of finalOrder) {
    const subjData = pcd[subj]
    const normalizedSubj = normalizeSubj(subj)
    const isBonus = subj === 'Bonus' || normalizedSubj === 'Bonus'

    for (const [sectionName, sectionQs] of Object.entries(subjData)) {
      const ansSection = (ak[subj] || {})[sectionName] || {}
      const sortedKeys = Object.keys(sectionQs).sort((a,b) => parseInt(a)-parseInt(b))
      for (const qnumStr of sortedKeys) {
        const q = sectionQs[qnumStr]

        // Handle BOTH answer formats:
        // New: { correctAnswer: [2], type, answerOptions }
        // Old: "2" or 2 (plain number/string)
        const ansRaw = ansSection[qnumStr]
        let ansLetter = ''
        if (ansRaw !== undefined && ansRaw !== null && ansRaw !== '') {
          if (typeof ansRaw === 'object' && Array.isArray(ansRaw.correctAnswer)) {
            ansLetter = OPT_MAP[String(ansRaw.correctAnswer[0])] || String(ansRaw.correctAnswer[0])
          } else {
            ansLetter = OPT_MAP[String(ansRaw)] || String(ansRaw)
          }
        }

        // Collect images
        const images = []
        for (let i = 1; i <= 10; i++) {
          const key1 = `${subj}__--__${qnumStr}__--__${i}`
          const key2 = `${normalizedSubj}__--__${qnumStr}__--__${i}`
          const img = imageMap[key1] || imageMap[key2]
          if (img) images.push(img)
          else break
        }

        const numOpts = parseInt(q.answerOptions) || 4
        questions.push({
          qnum: parseInt(qnumStr),  // preserve original question number
          subject: isBonus ? 'Bonus' : normalizedSubj,
          isBonus: isBonus || undefined,
          type: q.type === 'mcq' ? 'MCQ' : 'INTEGER',
          opts: ['A','B','C','D'].slice(0, numOpts),
          ans: ansLetter,
          images,
          mCor: q.marks?.cm || 3,
          mNeg: Math.abs(q.marks?.im || 1),
        })
      }
    }
  }

  if (!questions.length) throw new Error('No questions found. Check zip format.')

  const bonusCount = questions.filter(q => q.isBonus).length

  return {
    id: 'bitsat_' + Date.now(),
    title: testName,
    subject: 'BITSAT',
    dur: 180,
    mCor: 3,
    mNeg: 1,
    order: 999,
    hasBonus: bonusCount > 0,
    questions
  }
}

function ScheduleTab({ tok, schedules, setSchedules, flash, schedOpenFolder, setSchedOpenFolder }) {
  const [storageTree, setStorageTree] = useState(null)
  const [stLoading, setStLoading] = useState(true)
  const [editingPath, setEditingPath] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('09:00')

  useEffect(()=>{
    fetch('/api/storage-tests')
      .then(r=>r.ok?r.json():{folders:{}})
      .then(d=>{ setStorageTree(d); setStLoading(false) })
      .catch(()=>setStLoading(false))
  },[])

  const folderMap = {}
  if(storageTree?.folders) Object.entries(storageTree.folders).forEach(([f,d])=>{ folderMap[f]=(d.tests||[]) })
  const folderNames = Object.keys(folderMap)

  const saveSchedule = async (updated) => {
    setSchedules(updated)
    const res = await fetch('/api/admin/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ schedules: updated })
    })
    if (!res.ok) {
      const err = await res.json().catch(()=>({}))
      console.error('Schedule save failed:', err)
      flash('❌ Save failed: ' + (err.error || res.status))
    }
  }

  const getMode = (tp) => {
    const ex = schedules.find(s=>s.testPath===tp)
    return ex?.mode || 'available'
  }

  const setMode = async (tp, testTitle, mode) => {
    const updated = schedules.filter(s=>s.testPath!==tp)
    if(mode==='hidden') updated.push({testPath:tp, testTitle, mode:'hidden'})
    else if(mode==='schedule') {
      setEditingPath(tp)
      // Pre-fill with existing date or tomorrow 9am
      const ex = schedules.find(s=>s.testPath===tp)
      if(ex?.releaseAt) {
        const d = new Date(ex.releaseAt)
        setEditDate(d.toISOString().slice(0,10))
        setEditTime(d.toTimeString().slice(0,5))
      } else {
        const tom = new Date(Date.now()+86400000)
        setEditDate(tom.toISOString().slice(0,10))
        setEditTime('09:00')
      }
      return
    }
    // available — remove any restriction
    await saveSchedule(updated)
    flash('✅ Test is now always available')
  }

  const confirmSchedule = async (tp, testTitle) => {
    if(!editDate) return
    const releaseAt = new Date(`${editDate}T${editTime||'09:00'}`).toISOString()
    const updated = schedules.filter(s=>s.testPath!==tp)
    updated.push({testPath:tp, testTitle, mode:'schedule', releaseAt})
    await saveSchedule(updated)
    setEditingPath(null)
    flash(`🔒 Scheduled for ${new Date(releaseAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`)
  }

  const modeLabel = (tp) => {
    const ex = schedules.find(s=>s.testPath===tp)
    if(!ex || ex.mode==='available') return {label:'✅ Always Available', color:'#2e7d32', bg:'#f1f8f3', border:'#c8e6c9'}
    if(ex.mode==='hidden') return {label:'🚫 Hidden', color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db'}
    if(ex.mode==='schedule') {
      const isPast = new Date(ex.releaseAt) <= Date.now()
      return isPast
        ? {label:'✅ Live', color:'#2e7d32', bg:'#f1f8f3', border:'#c8e6c9'}
        : {label:`🔒 ${new Date(ex.releaseAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} ${new Date(ex.releaseAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`, color:'#e65100', bg:'#fff3e0', border:'#ffcc80'}
    }
    return {label:'✅ Available', color:'#2e7d32', bg:'#f1f8f3', border:'#c8e6c9'}
  }

  return (
    <div className="section">
      <div className="sec-head">
        <h1>🗓️ Test Scheduling</h1>
        <p>Control when each test is visible and available to students</p>
      </div>
      {stLoading && <div style={{color:'#888',padding:20,textAlign:'center'}}>⏳ Loading tests from storage…</div>}
      {!stLoading && folderNames.length===0 && <div style={{color:'#888',padding:20}}>No tests found. Upload via BITSAT ZIP tab first.</div>}
      {!stLoading && folderNames.length>0 && <>
        {/* Folder tabs */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20,borderBottom:'1.5px solid #e8eaf6',paddingBottom:12}}>
          {folderNames.map(f=>(
            <button key={f} onClick={()=>setSchedOpenFolder(schedOpenFolder===f?null:f)}
              style={{padding:'7px 18px',borderRadius:20,border:'none',
                background:schedOpenFolder===f?'#1a237e':'#e8eaf6',
                color:schedOpenFolder===f?'white':'#3949ab',
                fontFamily:'Inter,sans-serif',fontWeight:600,fontSize:'.8rem',cursor:'pointer',transition:'all .15s'}}>
              📁 {f} <span style={{opacity:.7,fontWeight:400}}>({(folderMap[f]||[]).length})</span>
            </button>
          ))}
        </div>

        {/* Tests in selected folder */}
        {!schedOpenFolder && <div style={{color:'#aaa',padding:'20px 0',textAlign:'center'}}>👆 Select a folder above to manage its tests</div>}
        {schedOpenFolder && (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {(folderMap[schedOpenFolder]||[]).map((t,i)=>{
              const tp = t.path||t.id||''
              const ml = modeLabel(tp)
              const isEditing = editingPath===tp
              return(
                <div key={i} style={{background:'white',border:'1.5px solid #e8eaf6',borderRadius:12,padding:'14px 18px',transition:'box-shadow .15s',boxShadow:'0 1px 4px rgba(26,35,126,.06)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    {/* Test info */}
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontWeight:700,fontSize:'.9rem',color:'#1a237e'}}>{t.title||tp}</div>
                    </div>
                    {/* Status badge */}
                    <span style={{fontSize:'.72rem',fontWeight:700,color:ml.color,background:ml.bg,border:`1px solid ${ml.border}`,padding:'4px 12px',borderRadius:20,flexShrink:0}}>{ml.label}</span>
                    {/* Mode dropdown */}
                    <select
                      value={getMode(tp)==='schedule' ? 'schedule' : getMode(tp)}
                      onChange={e=>setMode(tp, t.title||tp, e.target.value)}
                      style={{border:'1.5px solid #e8eaf6',borderRadius:8,padding:'6px 10px',fontSize:'.78rem',fontFamily:'Inter,sans-serif',color:'#1a237e',background:'white',cursor:'pointer',fontWeight:600}}>
                      <option value="available">✅ Always Available</option>
                      <option value="schedule">🔒 Schedule Release</option>
                      <option value="hidden">🚫 Hide from Students</option>
                    </select>
                  </div>
                  {/* Inline date/time picker when scheduling */}
                  {isEditing && (
                    <div style={{marginTop:12,padding:'14px 16px',background:'#f8fafc',borderRadius:10,border:'1.5px solid #c5cae9',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                      <div style={{flex:1,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                        <div>
                          <div style={{fontSize:'.65rem',fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Release Date</div>
                          <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)}
                            style={{border:'1.5px solid #c5cae9',borderRadius:8,padding:'8px 12px',fontSize:'.85rem',fontFamily:'Inter,sans-serif',color:'#1a237e',background:'white'}}/>
                        </div>
                        <div>
                          <div style={{fontSize:'.65rem',fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>Release Time</div>
                          <input type="time" value={editTime} onChange={e=>setEditTime(e.target.value)}
                            style={{border:'1.5px solid #c5cae9',borderRadius:8,padding:'8px 12px',fontSize:'.85rem',fontFamily:'Inter,sans-serif',color:'#1a237e',background:'white'}}/>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>confirmSchedule(tp, t.title||tp)}
                          style={{background:'#1a237e',color:'white',border:'none',padding:'9px 20px',borderRadius:8,fontFamily:'Inter,sans-serif',fontWeight:700,fontSize:'.8rem',cursor:'pointer'}}>
                          Set Schedule
                        </button>
                        <button onClick={()=>setEditingPath(null)}
                          style={{background:'transparent',color:'#64748b',border:'1.5px solid #e2e8f0',padding:'9px 14px',borderRadius:8,fontFamily:'Inter,sans-serif',fontSize:'.8rem',cursor:'pointer'}}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {schedules.filter(s=>s.mode!=='available').length>0 && (
          <div style={{marginTop:28,padding:'16px 20px',background:'#f8fafc',borderRadius:12,border:'1px solid #e8eaf6'}}>
            <div style={{fontWeight:700,color:'#1a237e',fontSize:'.85rem',marginBottom:10}}>📋 Active Restrictions</div>
            {schedules.filter(s=>s.mode!=='available').map((s,i)=>{
              const isPast = s.mode==='schedule' && new Date(s.releaseAt)<=Date.now()
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid #f1f5f9'}}>
                  <span style={{fontSize:'.8rem',flex:1,fontWeight:600,color:'#1a237e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.testTitle||s.testPath}</span>
                  <span style={{fontSize:'.7rem',fontWeight:600,color:s.mode==='hidden'?'#6b7280':isPast?'#2e7d32':'#e65100',flexShrink:0}}>
                    {s.mode==='hidden'?'🚫 Hidden':isPast?'✅ Live':`🔒 ${new Date(s.releaseAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </>}
    </div>
  )
}

export default function AdminPage() {
  const [tok, setTok]       = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [tab, setTab]       = useState('bitsat')
  const [tests, setTests]   = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]       = useState({txt:'',ok:true})
  const [editTest, setEditTest] = useState(null)
  // Exams tab
  const [exams, setExams]   = useState([])
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  // Users tab
  const [users, setUsers]   = useState([])
  const [siteStats, setSiteStats] = useState({totalAttempts:0})
  // Announcements
  const [whatsNew, setWhatsNew] = useState([])
  const [wnText, setWnText]  = useState('')
  // Top banner announcement
  const [annText, setAnnText]   = useState('')
  const [annEmoji, setAnnEmoji] = useState('🆕')
  const [annType, setAnnType]   = useState('new')
  const [annLink, setAnnLink]   = useState('')
  const [annLinkLabel, setAnnLinkLabel] = useState('')
  const [annActive, setAnnActive] = useState(false)
  // Scheduling
  const [schedules, setSchedules]   = useState([])
  const [schedFolders, setSchedFolders] = useState({})
  const [schedOpenFolder, setSchedOpenFolder] = useState(null)
  // Support links

  // BITSAT processor
  const [zipFile, setZipFile]     = useState(null)
  const [testName, setTestName]   = useState('')
  const [folderName, setFolderName] = useState('BITSAT 1')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress]   = useState('')
  const [result, setResult]       = useState(null)
  const [zipDrag, setZipDrag]     = useState(false)
  const zipRef = useRef()

  useEffect(() => {
    const t = localStorage.getItem(ADM_KEY)
    if (t) { setTok(t); setLoggedIn(true); loadTests(t); loadSiteData(); loadUsers(t) }
  }, [])

  const adm = async (action, body, t) => {
    const r = await fetch(`/api/admin/ops?action=${action}`, {
      method: body?'POST':'GET',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(t||tok)},
      body: body?JSON.stringify(body):undefined
    })
    return r.json()
  }

  const loadTests = async (t) => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/ops?action=list-tests',{headers:{Authorization:'Bearer '+(t||tok)}})
      const d = await r.json()
      if (Array.isArray(d)) setTests(d)
    } catch(e) {}
    setLoading(false)
  }

  const loadSiteData = async () => {
    try {
      const r = await fetch('/api/site-stats')
      const d = await r.json()
      setSiteStats({ totalAttempts: d.totalAttempts||0 })
      setExams(d.exams||[])
      setWhatsNew(d.whatsNew||[])
      if (d.announcement) {
        setAnnText(d.announcement.text||'')
        setAnnEmoji(d.announcement.emoji||'🆕')
        setAnnType(d.announcement.type||'new')
        setAnnLink(d.announcement.link||'')
        setAnnLinkLabel(d.announcement.linkLabel||'')
        setAnnActive(true)
      }
    } catch(e) {}
    try {
    } catch(e) {}
    try {
      const r = await fetch('/api/admin/schedule')
      if (r.ok) setSchedules(await r.json())
    } catch(e) {}
  }

  const loadUsers = async (t) => {
    try {
      const r = await fetch('/api/admin/users', { headers: { Authorization:'Bearer '+(t||tok) } })
      if (r.ok) { const d = await r.json(); setUsers(d||[]) }
    } catch(e) {}
  }

  const login = async () => {
    setLoginErr('')
    const r = await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})
    const d = await r.json()
    if (d.error){setLoginErr(d.error);return}
    localStorage.setItem(ADM_KEY,d.token)
    setTok(d.token); setLoggedIn(true); loadTests(d.token); loadSiteData(); loadUsers(d.token)
  }

  const logout = () => {localStorage.removeItem(ADM_KEY);setLoggedIn(false);setTok('')}
  const flash = (txt,ok=true) => {setMsg({txt,ok});setTimeout(()=>setMsg({txt:'',ok:true}),4000)}

  const handleDrop = (e) => {
    e.preventDefault(); setZipDrag(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.zip')) {
      setZipFile(f); setResult(null)
      setTestName(f.name.replace(/\.zip$/i,'').replace(/[-_]/g,' ').trim())
    } else flash('Please drop a .zip file', false)
  }

  const processZip = async () => {
    if (!zipFile || !testName.trim()) return
    setProcessing(true); setResult(null)
    try {
      const testData = await processBitsatZip(zipFile, testName.trim(), setProgress)
      setProgress('Done! ✅')
      setResult({ ok:true, testData, questions: testData.questions.length })
      setZipFile(null); setTestName('')
    } catch(e) {
      setResult({ ok:false, error: e.message })
      flash('❌ '+e.message, false)
    }
    setProcessing(false)
  }

  const uploadToStorage = async (testData) => {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!sbUrl) { flash('❌ Supabase URL not set'); return }
    const folder = folderName.trim() || 'BITSAT 1'
    const safeName = testName.replace(/[^a-zA-Z0-9_\-\s]/g,'').replace(/\s+/g,'_') || 'test'
    const storagePath = `${folder}/${safeName}.json`
    setProgress('Uploading to Supabase Storage…')
    try {
      const r = await fetch('/api/admin/upload-to-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer '+tok },
        body: JSON.stringify({ testData, storagePath })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Upload failed')
      flash(`✅ Uploaded to tests/${storagePath}`)
      setResult(prev => prev ? {...prev, uploaded: true, storagePath} : prev)
    } catch(e) {
      flash('❌ Upload failed: ' + e.message)
    }
    setProgress('')
  }

  const downloadJSON = (testData) => {
    const blob = new Blob([JSON.stringify(testData, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${testData.title.replace(/\s+/g,'_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const saveExams = async (newExams) => {
    const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    await fetch('/api/site-stats', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:'Bearer '+tok },
      body: JSON.stringify({ exams: newExams, adminToken: tok })
    })
    setExams(newExams)
    flash('✅ Exams saved!')
  }

  const addExam = () => {
    if (!examName.trim() || !examDate) return
    const updated = [...exams, { name: examName.trim(), date: examDate }]
    saveExams(updated)
    setExamName(''); setExamDate('')
  }

  const removeExam = (i) => saveExams(exams.filter((_,j)=>j!==i))

  const saveTest = async () => {
    const d = await adm('rename-test', editTest)
    if (d.ok){flash('✅ Saved!');setEditTest(null);loadTests()}
    else flash('❌ '+d.error,false)
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <>
      <Head><title>Admin — TestZyro</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`${BASE}
        body{background:linear-gradient(135deg,#0d1b4b 0%,#1a237e 100%);display:flex;align-items:center;justify-content:center;min-height:100vh}
        .card{background:white;border-radius:20px;padding:44px 40px;width:380px;box-shadow:0 32px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:14px}
        .logo-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
        .logo-mk{width:42px;height:42px;background:#1a237e;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#ffeb3b;font-weight:800;font-size:.9rem}
        h2{font-size:1.5rem;font-weight:800;color:#1a237e}
        .sub{font-size:.8rem;color:#999;margin-top:-8px}
        input{background:#f5f7ff;border:1.5px solid #e0e4ff;border-radius:10px;padding:12px 14px;font-family:'Inter',sans-serif;font-size:.9rem;outline:none;width:100%;color:#212121}
        input:focus{border-color:#1a237e}
        .btn{background:linear-gradient(135deg,#1a237e,#3949ab);color:white;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:.92rem;cursor:pointer;width:100%}
        .btn:hover{opacity:.9}
        .err{background:#fff0f0;border:1px solid #ffcdd2;color:#c62828;padding:10px 14px;border-radius:8px;font-size:.8rem}
      `}</style>
      <div className="card">
        <div className="logo-row"><div className="logo-mk">TZ</div><div><h2>Admin</h2><div className="sub">TestZyro Control Panel</div></div></div>
        <input type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/>
        {loginErr && <div className="err">{loginErr}</div>}
        <button className="btn" onClick={login}>Sign In →</button>
      </div>
    </>
  )

  // ── Admin Panel ───────────────────────────────────────────────────────────
  const folders = [...new Set(tests.map(t=>t.path.includes('/')?t.path.split('/')[0]:'root'))]

  return (
    <>
      <Head><title>Admin — TestZyro</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`${BASE}${PANEL}`}</style>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="s-mark">TZ</div>
            <div className="s-name">TestZyro<br/><span>Admin</span></div>
          </div>
          <nav className="sidebar-nav">
            {[
              ['bitsat','📦','ZIP→JSON'],
              ['tests','📋','All Tests'],
              ['schedule','🗓️','Schedule'],
              ['exams','📅','Exam Dates'],
              ['announce','📢','Announce'],
              ['users','👥','Users'],
              ['solutions','📄','Solutions'],
              ['json','📤','JSON Upload'],
            ].map(([t,ic,lb])=>(
              <button key={t} className={`s-btn${tab===t?' on':''}`} onClick={()=>{setTab(t);if((t==='schedule'||t==='tests')&&tests.length===0)loadTests()}}>
                <span className="s-ic">{ic}</span><span>{lb}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a href="/" className="s-link">← Back to Site</a>
            <button className="s-logout" onClick={logout}>Sign Out</button>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Toast */}
          {msg.txt && <div className={`toast ${msg.ok?'tok':'terr'}`}>{msg.txt}</div>}

          {/* ═══ BITSAT ZIP ═══ */}
          {tab==='bitsat' && (
            <div className="section">
              <div className="sec-head">
                <h1>📦 Add Test from ZIP</h1>
                <p>Upload a paper ZIP — questions & images auto-extracted, then uploaded directly to Supabase Storage</p>
              </div>

              {/* Format box */}
              <div className="format-box">
                <div className="fb-title">Expected ZIP structure:</div>
                <div className="fb-files">
                  <div className="fb-file"><span className="fb-ic">📄</span><div><b>data.json</b><span>pdfCropperData + testAnswerKey</span></div></div>
                  <div className="fb-file"><span className="fb-ic">🖼️</span><div><b>Subject__--__QNum__--__1.png</b><span>e.g. Physics__--__5__--__1.png</span></div></div>
                </div>
                <div className="fb-subjs">
                  {['Physics','Chemistry','English & LR','Maths','Biology'].map(s=><span key={s} className="fb-pill">{s}</span>)}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={`dropzone${zipDrag?' drag':''}`}
                onDragOver={e=>{e.preventDefault();setZipDrag(true)}}
                onDragLeave={()=>setZipDrag(false)}
                onDrop={handleDrop}
                onClick={()=>!zipFile&&zipRef.current.click()}
              >
                {!zipFile ? (
                  <div className="dz-empty">
                    <div className="dz-icon">📦</div>
                    <div className="dz-title">Drop BITSAT ZIP here</div>
                    <div className="dz-sub">or click to browse · Max 200MB</div>
                    <button className="dz-btn" onClick={e=>{e.stopPropagation();zipRef.current.click()}}>Choose ZIP File</button>
                  </div>
                ) : (
                  <div className="dz-file">
                    <span style={{fontSize:'2rem'}}>📦</span>
                    <div className="dz-file-info">
                      <div className="dz-file-name">{zipFile.name}</div>
                      <div className="dz-file-size">{(zipFile.size/1024/1024).toFixed(2)} MB</div>
                    </div>
                    <button className="dz-remove" onClick={e=>{e.stopPropagation();setZipFile(null);setResult(null);setTestName('')}}>✕ Remove</button>
                  </div>
                )}
                <input ref={zipRef} type="file" accept=".zip" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f){setZipFile(f);setResult(null);setTestName(f.name.replace(/\.zip$/i,'').replace(/[-_]/g,' ').trim())}}}/>
              </div>

              {/* Name + Folder + Process */}
              {zipFile && (
                <div className="action-row">
                  <div className="field-wrap">
                    <label className="flabel">Test Name</label>
                    <input className="finput" value={testName} onChange={e=>setTestName(e.target.value)} placeholder="e.g. BITSAT 1 Mock 11"/>
                  </div>
                  <div className="field-wrap" style={{maxWidth:180}}>
                    <label className="flabel">Folder in Storage</label>
                    <input className="finput" value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="e.g. BITSAT 1"/>
                  </div>
                  <button className="proc-btn" onClick={processZip} disabled={processing||!testName.trim()}>
                    {processing ? <><span className="spin"/>Processing…</> : '⚡ Generate JSON'}
                  </button>
                </div>
              )}

              {/* Progress */}
              {processing && (
                <div className="prog-box">
                  <div className="prog-bar"><div className="prog-fill"/></div>
                  <div className="prog-txt">{progress}</div>
                </div>
              )}

              {/* Result */}
              {result?.ok && (
                <div className="result-ok">
                  <div className="result-ok-header">
                    <span className="result-ok-ic">✅</span>
                    <div>
                      <div className="result-ok-title">JSON Generated!</div>
                      <div className="result-ok-sub">{result.questions} questions across {[...new Set(result.testData.questions.map(q=>q.subject))].length} subjects</div>
                    </div>
                  </div>
                  <div className="result-stats">
                    {[...new Set(result.testData.questions.map(q=>q.subject))].map(s=>{
                      const count = result.testData.questions.filter(q=>q.subject===s).length
                      if (!count) return null
                      const withImg = result.testData.questions.filter(q=>q.subject===s&&q.images?.length>0).length
                      return (
                        <div key={s} className="stat-pill">
                          <span className="stat-subj">{s}</span>
                          <span className="stat-n">{count} Qs</span>
                          {withImg > 0 && <span className="stat-img">🖼️ {withImg}</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="result-actions">
                    {!result.uploaded ? (
                      <button className="proc-btn" onClick={()=>uploadToStorage(result.testData)} style={{background:'linear-gradient(135deg,#1565c0,#1e88e5)'}}>
                        ☁️ Upload to Supabase Storage
                      </button>
                    ) : (
                      <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:10,padding:'12px 16px',color:'#2e7d32',fontWeight:700,fontSize:'.88rem'}}>
                        ✅ Uploaded! Folder: <code style={{background:'rgba(0,0,0,.08)',padding:'2px 6px',borderRadius:4}}>{result.storagePath}</code>
                      </div>
                    )}
                    <button className="dl-btn" onClick={()=>downloadJSON(result.testData)} style={{marginTop:8}}>
                      📥 Download JSON (backup)
                    </button>
                  </div>
                </div>
              )}
              {result?.ok===false && (
                <div className="result-err">
                  <span style={{fontSize:'1.4rem'}}>❌</span>
                  <div>
                    <div style={{fontWeight:700,marginBottom:4}}>Processing Failed</div>
                    <div style={{fontSize:'.84rem',color:'#c62828'}}>{result.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ EXAM DATES ═══ */}
          {tab==='exams' && (
            <div className="section">
              <div className="sec-head">
                <h1>📅 Exam Countdown Tiles</h1>
                <p>These appear on the main page hero as countdown cards</p>
              </div>
              {/* Global stats row */}
              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-card-num">{siteStats.totalAttempts.toLocaleString()}</div>
                  <div className="stat-card-lbl">Total Tests Attempted</div>
                </div>
              </div>
              {/* Add exam */}
              <div className="format-box" style={{marginTop:20}}>
                <div className="fb-title">Add New Exam</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div className="field-wrap" style={{flex:2,minWidth:160}}>
                    <label className="flabel">Exam Name</label>
                    <input className="finput" style={{marginBottom:0}} value={examName} onChange={e=>setExamName(e.target.value)} placeholder="e.g. BITSAT 2026"/>
                  </div>
                  <div className="field-wrap" style={{flex:1,minWidth:140}}>
                    <label className="flabel">Exam Date</label>
                    <input className="finput" style={{marginBottom:0}} type="date" value={examDate} onChange={e=>setExamDate(e.target.value)}/>
                  </div>
                  <button className="proc-btn" onClick={addExam} disabled={!examName.trim()||!examDate}>+ Add</button>
                </div>
              </div>
              {/* Current exams */}
              <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
                {exams.length===0 && <div className="empty">No exams added yet</div>}
                {exams.map((ex,i)=>{
                  const days = Math.ceil((new Date(ex.date)-Date.now())/(1000*60*60*24))
                  return(
                    <div key={i} className="test-row" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:'.92rem',color:'#1a237e'}}>{ex.name}</div>
                        <div style={{fontSize:'.72rem',color:'#888',marginTop:2}}>{new Date(ex.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})} · {days>0?`${days} days left`:days===0?'Today!':'Past'}</div>
                      </div>
                      <button onClick={()=>removeExam(i)} style={{background:'#ffebee',border:'1px solid #ef9a9a',color:'#c62828',padding:'6px 12px',borderRadius:7,cursor:'pointer',fontSize:'.76rem',fontWeight:600,fontFamily:'Inter,sans-serif'}}>Remove</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ═══ USERS ═══ */}
          {tab==='users' && (
            <div className="section">
              <div className="sec-head">
                <h1>👥 Users & Activity</h1>
                <p>Registered users and their test activity</p>
              </div>
              <div className="stat-cards" style={{marginBottom:24}}>
                <div className="stat-card"><div className="stat-card-num">{users.length}</div><div className="stat-card-lbl">Registered Users</div></div>
                <div className="stat-card"><div className="stat-card-num">{siteStats.totalAttempts.toLocaleString()}</div><div className="stat-card-lbl">Total Attempts</div></div>
                <div className="stat-card"><div className="stat-card-num">{users.length>0?(siteStats.totalAttempts/users.length).toFixed(1):0}</div><div className="stat-card-lbl">Avg per User</div></div>
              </div>
              <button className="refresh-btn" onClick={()=>loadUsers()}>🔄 Refresh</button>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12}}>
                {users.length===0&&<div className="empty">No users found</div>}
                {users.map((u,i)=>(
                  <div key={i} className="test-row" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:'#e8eaf6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#1a237e',fontSize:'.9rem',flexShrink:0}}>
                      {(u.email||'?')[0].toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:'.88rem',color:'#1a237e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.email}</div>
                      <div style={{fontSize:'.68rem',color:'#aaa',marginTop:2}}>Joined {u.created_at?new Date(u.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'}</div>
                    </div>
                    <div style={{background:'#f0f3ff',border:'1px solid #e0e4ff',borderRadius:8,padding:'4px 10px',fontSize:'.72rem',fontWeight:700,color:'#3949ab',flexShrink:0}}>
                      {u.attempt_count||0} tests
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ ANNOUNCE ═══ */}
          {tab==='announce' && (
            <div className="section">
              <div className="sec-head">
                <h1>📢 Top Banner Announcement</h1>
                <p>Shows a full-width coloured banner at the very top of the site for all users</p>
              </div>

              {/* Preview */}
              {annText && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:'.7rem',fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'1px',marginBottom:8}}>Preview</div>
                  <div style={{
                    background: annType==='new'?'linear-gradient(90deg,#6366f1,#8b5cf6)':
                                annType==='warning'?'linear-gradient(90deg,#f59e0b,#ef4444)':
                                'linear-gradient(90deg,#10b981,#059669)',
                    padding:'10px 20px',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',gap:12,flexWrap:'wrap'
                  }}>
                    <span style={{fontSize:'1rem'}}>{annEmoji}</span>
                    <span style={{fontWeight:700,color:'white',fontSize:'.88rem'}}>{annText}</span>
                    {annLink && <span style={{background:'rgba(255,255,255,.25)',color:'white',padding:'3px 12px',borderRadius:20,fontSize:'.76rem',fontWeight:700,border:'1px solid rgba(255,255,255,.3)'}}>{annLinkLabel||'View →'}</span>}
                  </div>
                </div>
              )}

              <div className="format-box">
                <div className="fb-title">Banner Settings</div>
                {/* Type */}
                <div style={{marginBottom:14}}>
                  <label className="flabel">Type / Colour</label>
                  <div style={{display:'flex',gap:8}}>
                    {[['new','🟣 New / Update','linear-gradient(90deg,#6366f1,#8b5cf6)'],['success','🟢 Success / Live','linear-gradient(90deg,#10b981,#059669)'],['warning','🟠 Warning / Urgent','linear-gradient(90deg,#f59e0b,#ef4444)']].map(([val,label,bg])=>(
                      <button key={val} onClick={()=>setAnnType(val)} style={{flex:1,padding:'8px 12px',borderRadius:8,border:`2px solid ${annType===val?'#6366f1':'#e8eaf6'}`,background:annType===val?'#ede9fe':'white',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:'.75rem',fontWeight:600,color:'#1a237e',transition:'all .15s'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Emoji + Text */}
                <div style={{display:'flex',gap:10,marginBottom:14}}>
                  <div style={{width:80}}>
                    <label className="flabel">Emoji</label>
                    <input className="finput" style={{marginBottom:0,textAlign:'center',fontSize:'1.2rem'}} value={annEmoji} onChange={e=>setAnnEmoji(e.target.value)} placeholder="🆕"/>
                  </div>
                  <div style={{flex:1}}>
                    <label className="flabel">Message</label>
                    <input className="finput" style={{marginBottom:0}} value={annText} onChange={e=>setAnnText(e.target.value)} placeholder="e.g. New test uploaded: BITSAT 2026 Mock 3 🎉"/>
                  </div>
                </div>
                {/* Link */}
                <div style={{display:'flex',gap:10,marginBottom:20}}>
                  <div style={{flex:2}}>
                    <label className="flabel">Link URL (optional)</label>
                    <input className="finput" style={{marginBottom:0}} value={annLink} onChange={e=>setAnnLink(e.target.value)} placeholder="e.g. / or https://..."/>
                  </div>
                  <div style={{flex:1}}>
                    <label className="flabel">Button Label</label>
                    <input className="finput" style={{marginBottom:0}} value={annLinkLabel} onChange={e=>setAnnLinkLabel(e.target.value)} placeholder="View →"/>
                  </div>
                </div>
                {/* Actions */}
                <div style={{display:'flex',gap:10}}>
                  <button className="proc-btn" onClick={async()=>{
                    const val = annText.trim() ? { text:annText.trim(), emoji:annEmoji, type:annType, link:annLink, linkLabel:annLinkLabel } : null
                    const r = await fetch('/api/site-stats',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({announcement:val})})
                    if(r.ok){ setAnnActive(!!val); flash(val?'📢 Announcement published!':'✅ Announcement cleared') }
                    else flash('❌ Failed to save')
                  }}>
                    {annActive?'Update':'Publish'} Banner
                  </button>
                  {annActive && (
                    <button onClick={async()=>{
                      await fetch('/api/site-stats',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({announcement:null})})
                      setAnnText(''); setAnnActive(false); flash('✅ Banner removed')
                    }} style={{background:'transparent',border:'1.5px solid #ef5350',color:'#ef5350',padding:'8px 18px',borderRadius:8,fontFamily:'Inter,sans-serif',fontWeight:600,fontSize:'.8rem',cursor:'pointer'}}>
                      Remove Banner
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SCHEDULE ═══ */}
          {tab==='schedule' && <ScheduleTab tok={tok} schedules={schedules} setSchedules={setSchedules} flash={flash} schedOpenFolder={schedOpenFolder} setSchedOpenFolder={setSchedOpenFolder}/>}
          {tab==='schedule_DISABLED_OLD' && (
            <div className="section">
              <div className="sec-head">
                <h1>🗓️ Test Scheduling</h1>
              </div>
              {false && <div/>}

              {/* Folder browser */}
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
                {Object.keys(
                  tests.reduce((acc,t)=>{
                    const folder = t.path?.split('/')?.[0] || 'General'
                    acc[folder] = acc[folder]||[]
                    acc[folder].push(t)
                    return acc
                  },{})
                ).map(folder=>(
                  <button key={folder} onClick={()=>setSchedOpenFolder(schedOpenFolder===folder?null:folder)}
                    style={{padding:'8px 16px',borderRadius:8,border:`1.5px solid ${schedOpenFolder===folder?'#6366f1':'#e8eaf6'}`,
                      background:schedOpenFolder===folder?'#ede9fe':'white',color:schedOpenFolder===folder?'#4c1d95':'#1a237e',
                      fontFamily:'Inter,sans-serif',fontWeight:600,fontSize:'.8rem',cursor:'pointer',transition:'all .15s'}}>
                    📁 {folder}
                  </button>
                ))}
              </div>

              {/* Tests in selected folder */}
              {schedOpenFolder && (() => {
                const folderTests = tests.filter(t=>(t.path?.split('/')?.[0]||'General')===schedOpenFolder)
                return (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{fontWeight:700,color:'#1a237e',fontSize:'.9rem',marginBottom:4}}>📁 {schedOpenFolder} — {folderTests.length} tests</div>
                    {folderTests.map((t,i)=>{
                      const existing = schedules.find(s=>s.testPath===t.path)
                      const isScheduled = existing?.releaseAt
                      const isPast = isScheduled && new Date(existing.releaseAt) <= Date.now()
                      return(
                        <div key={i} className="test-row" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                          <div style={{flex:1,minWidth:200}}>
                            <div style={{fontWeight:700,fontSize:'.88rem',color:'#1a237e'}}>{t.title||t.path}</div>
                            <div style={{fontSize:'.68rem',color:'#aaa',marginTop:2}}>{t.path}</div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            {isScheduled && !isPast && (
                              <span style={{fontSize:'.7rem',background:'#fff3e0',color:'#e65100',border:'1px solid #ffcc80',padding:'3px 10px',borderRadius:20,fontWeight:600}}>
                                🔒 Releases {new Date(existing.releaseAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                              </span>
                            )}
                            {isPast && (
                              <span style={{fontSize:'.7rem',background:'#f1f8f3',color:'#2e7d32',border:'1px solid #c8e6c9',padding:'3px 10px',borderRadius:20,fontWeight:600}}>✅ Available</span>
                            )}
                            {!isScheduled && (
                              <span style={{fontSize:'.7rem',background:'#f1f8f3',color:'#2e7d32',border:'1px solid #c8e6c9',padding:'3px 10px',borderRadius:20,fontWeight:600}}>✅ Always Available</span>
                            )}
                            <input type="datetime-local"
                              defaultValue={existing?.releaseAt ? new Date(existing.releaseAt).toISOString().slice(0,16) : ''}
                              onChange={async(e)=>{
                                const val = e.target.value
                                const updated = schedules.filter(s=>s.testPath!==t.path)
                                if (val) updated.push({ testPath:t.path, testTitle:t.title||t.path, releaseAt: new Date(val).toISOString() })
                                setSchedules(updated)
                                await fetch('/api/admin/schedule', {
                                  method:'POST',
                                  headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},
                                  body:JSON.stringify({ schedules: updated })
                                })
                                flash(val ? `🔒 Scheduled for ${new Date(val).toLocaleString('en-IN')}` : '✅ Set to always available')
                              }}
                              style={{border:'1px solid #e8eaf6',borderRadius:7,padding:'5px 10px',fontSize:'.76rem',fontFamily:'Inter,sans-serif',color:'#1a237e',cursor:'pointer'}}
                            />
                            {isScheduled && (
                              <button onClick={async()=>{
                                const updated = schedules.filter(s=>s.testPath!==t.path)
                                setSchedules(updated)
                                await fetch('/api/admin/schedule',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({schedules:updated})})
                                flash('✅ Schedule removed — test always available')
                              }} style={{background:'transparent',border:'1px solid #ef5350',color:'#ef5350',padding:'5px 10px',borderRadius:7,fontSize:'.72rem',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Remove</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Summary of all scheduled tests */}
              {schedules.length > 0 && (
                <div style={{marginTop:24}}>
                  <div style={{fontWeight:700,color:'#1a237e',fontSize:'.85rem',marginBottom:8}}>All Scheduled Tests ({schedules.length})</div>
                  {schedules.map((s,i)=>{
                    const isPast = new Date(s.releaseAt) <= Date.now()
                    return(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderRadius:8,background:'#f8fafc',border:'1px solid #e8eaf6',marginBottom:6}}>
                        <span style={{fontSize:'.8rem',flex:1,fontWeight:600,color:'#1a237e'}}>{s.testTitle||s.testPath}</span>
                        <span style={{fontSize:'.7rem',color:isPast?'#2e7d32':'#e65100',fontWeight:600}}>
                          {isPast?'✅':'🔒'} {new Date(s.releaseAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* existing tabs below */}
          {tab==='tests' && (
            <div className="section">
              <div className="sec-head">
                <h1>📋 All Tests</h1>
                <p>{tests.length} tests loaded from public/tests/</p>
              </div>
              <button className="refresh-btn" onClick={()=>loadTests()}>🔄 Refresh</button>
              {loading && <div className="loading">Loading…</div>}
              {folders.map(folder=>{
                const ft = tests.filter(t=>(t.path.includes('/')?t.path.split('/')[0]:'root')===folder)
                return (
                  <div key={folder} className="folder-group">
                    <div className="folder-label">📁 {folder} <span style={{color:'#bbb',fontWeight:400}}>({ft.length})</span></div>
                    {ft.map(t=>(
                      <div key={t.path} className="test-row">
                        <div className="test-bar" style={{background:t.accentColor||'#1a237e'}}/>
                        <div className="test-info">
                          <div className="test-title">{t.title}</div>
                          <div className="test-meta">{t.path} · {t.questionCount} Qs · {t.subject} · +{t.mCor}/−{t.mNeg} · {t.dur}min</div>
                        </div>
                        <button className="edit-btn" onClick={()=>setEditTest({...t})}>✏️</button>
                      </div>
                    ))}
                  </div>
                )
              })}
              {!loading&&tests.length===0&&<div className="empty">No tests yet. Use BITSAT ZIP tab to add one.</div>}
            </div>
          )}

          {/* ═══ SOLUTIONS ═══ */}
          {tab==='solutions' && (
            <div className="section">
              <div className="sec-head">
                <h1>📄 Solutions / Answer Keys</h1>
                <p>Upload PDF solution files — organised by folder just like your test series</p>
              </div>
              <div className="format-box">
                <div className="fb-title">📁 Folder structure (in GitHub repo)</div>
                <pre className="code" style={{marginTop:8}}>{`public/solutions/
  BITSAT SERIES 1/
    BITSAT-1-SOL.pdf    ← name it same as test
    BITSAT-2-SOL.pdf
  BITSAT SERIES 2/
    BITSAT-1-SOL.pdf
  BITSAT SERIES 3 (PYQ)/
    BITSAT-PYQ-1-SOL.pdf`}</pre>
              </div>
              <div className="format-box" style={{marginTop:14}}>
                <div className="fb-title">✅ Steps to add solutions</div>
                <div style={{fontSize:'.84rem',color:'#333',lineHeight:2.2}}>
                  <b>1.</b> Go to your GitHub repo<br/>
                  <b>2.</b> Navigate to <code style={{background:'#f0f0f0',padding:'1px 6px',borderRadius:4,fontFamily:'monospace'}}>public/solutions/</code><br/>
                  <b>3.</b> Create a folder matching your series name (e.g. <code style={{background:'#f0f0f0',padding:'1px 6px',borderRadius:4,fontFamily:'monospace'}}>BITSAT SERIES 1</code>)<br/>
                  <b>4.</b> Upload your PDF file inside it<br/>
                  <b>5.</b> Commit &amp; push → appears on Solutions page instantly ✅
                </div>
              </div>
              <div style={{marginTop:16,textAlign:'center'}}>
                <a href="/solutions" target="_blank" className="proc-btn" style={{display:'inline-flex',textDecoration:'none'}}>
                  👁 View Solutions Page →
                </a>
              </div>
            </div>
          )}

          {/* ═══ JSON UPLOAD ═══ */}
          {tab==='json' && (
            <div className="section">
              <div className="sec-head">
                <h1>📤 Upload JSON Test File</h1>
                <p>Directly upload a pre-built .json test file to your saved library (browser only, no server)</p>
              </div>
              <div className="json-info">
                <b>Note:</b> Since Vercel filesystem is read-only, uploaded JSON tests are saved to your <b>browser's local storage</b> only (visible on this device). To add to all users, download the JSON from the BITSAT ZIP tab and commit it to GitHub.
              </div>
              <div className="format-box" style={{marginTop:16}}>
                <div className="fb-title">JSON format:</div>
                <pre className="code">{`{
  "title": "BITSAT Mock 3",
  "subject": "BITSAT",
  "dur": 180, "mCor": 3, "mNeg": 1,
  "questions": [
    { "subject": "Physics", "type": "MCQ",
      "text": "Q1", "opts":["A","B","C","D"],
      "ans": "B", "images": [] }
  ]
}`}</pre>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit modal */}
      {editTest && (
        <div className="modal-bg" onClick={()=>setEditTest(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{color:'#1a237e',marginBottom:16}}>✏️ Edit Test</h3>
            <label className="flabel">Title</label>
            <input className="finput" value={editTest.title} onChange={e=>setEditTest({...editTest,title:e.target.value})}/>
            <label className="flabel">Subject</label>
            <select className="finput" value={editTest.subject} onChange={e=>setEditTest({...editTest,subject:e.target.value})}>
              {['BITSAT','JEE','NEET','GATE','Board','Other'].map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label className="flabel">Duration (min)</label><input className="finput" type="number" value={editTest.dur} onChange={e=>setEditTest({...editTest,dur:e.target.value})}/></div>
              <div><label className="flabel">Order</label><input className="finput" type="number" value={editTest.order} onChange={e=>setEditTest({...editTest,order:e.target.value})}/></div>
              <div><label className="flabel">+Marks</label><input className="finput" type="number" value={editTest.mCor} onChange={e=>setEditTest({...editTest,mCor:e.target.value})}/></div>
              <div><label className="flabel">−Marks</label><input className="finput" type="number" value={editTest.mNeg} onChange={e=>setEditTest({...editTest,mNeg:e.target.value})}/></div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="proc-btn" style={{flex:1}} onClick={saveTest}>💾 Save</button>
              <button onClick={()=>setEditTest(null)} style={{padding:'10px 20px',border:'1px solid #ddd',borderRadius:8,cursor:'pointer',background:'white'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const BASE = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#f0f2f8;color:#1a1a2e;min-height:100vh}`

const PANEL = `
.layout{display:flex;min-height:100vh}
/* Sidebar */
.sidebar{width:220px;background:linear-gradient(180deg,#0d1b4b 0%,#1a237e 100%);display:flex;flex-direction:column;padding:0;flex-shrink:0;position:sticky;top:0;height:100vh}
.sidebar-logo{padding:24px 20px 20px;border-bottom:1px solid rgba(255,255,255,.1)}
.s-mark{width:36px;height:36px;background:#ffeb3b;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;color:#1a237e;margin-bottom:8px}
.s-name{font-weight:800;font-size:1.05rem;color:white;line-height:1.2}
.s-name span{font-size:.68rem;color:rgba(255,255,255,.5);font-weight:400}
.sidebar-nav{padding:16px 10px;display:flex;flex-direction:column;gap:4px;flex:1}
.s-btn{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,.65);font-family:'Inter',sans-serif;font-weight:600;font-size:.84rem;cursor:pointer;text-align:left;transition:all .15s}
.s-btn:hover{background:rgba(255,255,255,.1);color:white}
.s-btn.on{background:rgba(255,255,255,.18);color:white}
.s-ic{font-size:1.1rem;width:22px;text-align:center}
.sidebar-bottom{padding:16px 10px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:6px}
.s-link{color:rgba(255,255,255,.55);font-size:.76rem;text-decoration:none;padding:8px 14px;border-radius:8px;display:block}
.s-link:hover{color:white;background:rgba(255,255,255,.08)}
.s-logout{background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#fca5a5;padding:8px 14px;border-radius:8px;font-size:.76rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif}
/* Main */
.main{flex:1;padding:32px 36px;overflow-y:auto;max-width:860px}
.toast{position:fixed;top:20px;right:20px;padding:12px 22px;border-radius:12px;font-weight:700;font-size:.84rem;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.tok{background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7}
.terr{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.section{}
.sec-head{margin-bottom:24px}
.sec-head h1{font-size:1.5rem;font-weight:800;color:#1a237e;margin-bottom:6px}
.sec-head p{font-size:.85rem;color:#888}
/* Format box */
.format-box{background:white;border-radius:14px;padding:18px 20px;margin-bottom:20px;border:1px solid #e8eaf6;box-shadow:0 2px 8px rgba(26,35,126,.06)}
.fb-title{font-size:.7rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px}
.fb-files{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.fb-file{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8f9ff;border-radius:8px;border:1px solid #e8eaf6;font-size:.84rem}
.fb-ic{font-size:1.4rem}
.fb-file b{display:block;font-weight:700;color:#1a237e;margin-bottom:2px}
.fb-file span{font-size:.72rem;color:#888}
.fb-subjs{display:flex;gap:6px;flex-wrap:wrap}
.fb-pill{background:#e8eaf6;color:#1a237e;font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #c5cae9}
/* Dropzone */
.dropzone{background:white;border:2.5px dashed #c5cae9;border-radius:16px;padding:40px;text-align:center;cursor:pointer;transition:all .22s;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.dropzone:hover,.dropzone.drag{border-color:#1a237e;background:#f0f3ff;box-shadow:0 4px 20px rgba(26,35,126,.12)}
.dz-empty{}
.dz-icon{font-size:3.2rem;margin-bottom:12px}
.dz-title{font-size:1.1rem;font-weight:800;color:#1a237e;margin-bottom:6px}
.dz-sub{font-size:.82rem;color:#888;margin-bottom:18px}
.dz-btn{background:#1a237e;color:white;border:none;padding:11px 30px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.86rem;cursor:pointer}
.dz-btn:hover{background:#283593}
.dz-file{display:flex;align-items:center;gap:16px}
.dz-file-info{flex:1;text-align:left}
.dz-file-name{font-weight:700;font-size:.95rem;color:#1a237e;margin-bottom:3px}
.dz-file-size{font-size:.72rem;color:#888}
.dz-remove{background:#ffebee;border:1px solid #ef9a9a;color:#c62828;padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:.76rem;font-family:'Inter',sans-serif;white-space:nowrap}
/* Action row */
.action-row{display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap}
.field-wrap{flex:1;min-width:200px}
.flabel{font-size:.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.8px;display:block;margin-bottom:5px}
.finput{width:100%;background:#f8f9ff;border:1.5px solid #e0e4ff;border-radius:9px;padding:11px 14px;font-family:'Inter',sans-serif;font-size:.9rem;color:#212121;outline:none;transition:border-color .2s;margin-bottom:10px}
.finput:focus{border-color:#1a237e}
.proc-btn{background:linear-gradient(135deg,#1a237e,#3949ab);color:white;border:none;padding:12px 28px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 4px 14px rgba(26,35,126,.3)}
.proc-btn:hover{opacity:.92;transform:translateY(-1px)}
.proc-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.spin{width:16px;height:16px;border:2.5px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* Progress */
.prog-box{background:white;border-radius:12px;padding:18px;margin-bottom:16px;border:1px solid #e8eaf6;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.prog-bar{height:8px;background:#e8eaf6;border-radius:99px;overflow:hidden;margin-bottom:10px}
.prog-fill{height:100%;background:linear-gradient(90deg,#1a237e,#3949ab,#1a237e);background-size:200%;border-radius:99px;animation:shimmer 1.5s ease infinite}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
.prog-txt{font-size:.8rem;color:#666}
/* Result ok */
.result-ok{background:white;border-radius:16px;border:1px solid #a5d6a7;overflow:hidden;margin-bottom:16px;box-shadow:0 4px 20px rgba(46,125,50,.1)}
.result-ok-header{display:flex;align-items:center;gap:14px;padding:20px 22px;background:linear-gradient(135deg,#e8f5e9,#f1f8f3);border-bottom:1px solid #c8e6c9}
.result-ok-ic{font-size:2rem}
.result-ok-title{font-size:1.05rem;font-weight:800;color:#1b5e20;margin-bottom:3px}
.result-ok-sub{font-size:.8rem;color:#2e7d32}
.result-stats{padding:16px 22px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #e8f5e9}
/* Stat cards */
.stat-cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.stat-card{background:white;border:1px solid #e8eaf6;border-radius:14px;padding:16px 20px;flex:1;min-width:120px;box-shadow:0 2px 8px rgba(26,35,126,.06)}
.stat-card-num{font-size:1.8rem;font-weight:900;color:#1a237e;line-height:1}
.stat-card-lbl{font-size:.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.8px;margin-top:6px}
/* Stat pills (existing) */
.stat-subj{font-weight:700;font-size:.78rem;color:#1b5e20}
.stat-n{font-size:.74rem;color:#555}
.stat-img{font-size:.7rem;color:#888}
.result-actions{padding:16px 22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.dl-btn{background:linear-gradient(135deg,#1a237e,#3949ab);color:white;border:none;padding:12px 28px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.9rem;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(26,35,126,.25)}
.dl-btn:hover{opacity:.9;transform:translateY(-1px)}
.dl-hint{font-size:.76rem;color:#666;line-height:1.7}
.dl-hint code{background:#f0f2f8;border:1px solid #e0e4ff;padding:1px 7px;border-radius:4px;font-family:monospace;font-size:.75rem}
/* Result err */
.result-err{background:#fff5f5;border:1px solid #ef9a9a;border-radius:14px;padding:18px 22px;display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
/* Tests */
.refresh-btn{background:white;border:1.5px solid #e0e4ff;color:#1a237e;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;margin-bottom:20px;font-family:'Inter',sans-serif}
.folder-group{margin-bottom:24px}
.folder-label{font-size:.72rem;font-weight:800;color:#1a237e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}
.test-row{background:white;border:1px solid #e8eaf6;border-radius:12px;display:flex;align-items:center;overflow:hidden;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.05);transition:transform .15s,box-shadow .15s}
.test-row:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.08)}
.test-bar{width:6px;align-self:stretch;flex-shrink:0}
.test-info{flex:1;padding:12px 16px;min-width:0}
.test-title{font-weight:700;font-size:.92rem;color:#1a237e;margin-bottom:3px}
.test-meta{font-size:.65rem;color:#aaa;display:flex;gap:4px;flex-wrap:wrap}
.edit-btn{padding:8px 14px;margin:10px;border-radius:8px;background:#f0f3ff;border:1px solid #e0e4ff;color:#1a237e;font-size:.78rem;cursor:pointer;font-weight:600;font-family:'Inter',sans-serif}
.edit-btn:hover{background:#e8eaf6}
.loading{color:#888;font-size:.84rem;padding:20px 0;text-align:center}
.empty{color:#ccc;font-size:.84rem;padding:48px 0;text-align:center}
/* JSON info */
.json-info{background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:14px 18px;font-size:.82rem;color:#5d4037;line-height:1.8;margin-bottom:16px}
.code{background:#1e2a3a;color:#80cbc4;border-radius:10px;padding:16px;font-size:.74rem;overflow-x:auto;line-height:1.7}
/* Modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:white;border-radius:18px;padding:28px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.25)}
/* Bonus */
.bonus-section{background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:16px 18px;margin-bottom:16px}
.bonus-toggle-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px}
.bonus-toggle-label{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.88rem;color:#5d4037;cursor:pointer}
.bonus-toggle-label input{width:16px;height:16px;cursor:pointer;accent-color:#e65100}
.bonus-note{font-size:.7rem;color:#888;font-style:italic}
.bonus-body{margin-top:14px;display:flex;flex-direction:column;gap:12px}
.bonus-zip-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bonus-pick-btn{background:#e65100;color:white;border:none;padding:8px 16px;border-radius:7px;font-family:'Inter',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer}
.bonus-pick-btn:hover{background:#bf360c}
.bonus-file-row{display:flex;align-items:center;gap:8px}
.bonus-file-name{font-size:.78rem;color:#333;font-weight:600}
.bonus-remove{background:none;border:1px solid #ccc;border-radius:4px;padding:2px 8px;cursor:pointer;color:#999;font-size:.75rem}
.bonus-count-row{display:flex;align-items:center;gap:10px}
.bonus-ans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px}
.bonus-ans-cell{display:flex;align-items:center;gap:5px;background:white;border:1px solid #ffe082;border-radius:6px;padding:5px 8px}
.bonus-ans-num{font-size:.65rem;font-weight:800;color:#e65100;font-family:monospace;min-width:22px}
.bonus-ans-sel{border:none;background:transparent;font-family:'Inter',sans-serif;font-size:.82rem;font-weight:700;color:#1a237e;cursor:pointer;outline:none;padding:0}
`
