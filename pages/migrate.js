import { useState } from 'react'
import Head from 'next/head'

const KEYS = ['tz_saved_v3','tz_resume_v1','tz_attempts_v1','tz_bookmarks_v1','tz_dark_mode']

export default function Migrate() {
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)

  const exportAll = () => {
    const data = {}
    KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v) data[k] = v } catch(e){} })
    data._exported = new Date().toISOString()
    data._version = '1'
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url
    a.download = `testzyro_backup_${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
    setStatus('✅ Exported successfully! Save this file safely.')
  }

  const importAll = async (file) => {
    setImporting(true); setStatus('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      let count = 0
      KEYS.forEach(k => { if (data[k]) { localStorage.setItem(k, data[k]); count++ } })
      setStatus(`✅ Imported ${count} data categories! Refresh the site to see your data.`)
    } catch(e) { setStatus('❌ Invalid file: ' + e.message) }
    setImporting(false)
  }

  return (
    <>
      <Head><title>TestZyro — Migrate Data</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:#f0f4ff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
        .hdr{position:fixed;top:0;left:0;right:0;height:56px;background:#1a237e;display:flex;align-items:center;padding:0 24px;z-index:10}
        .hdr-logo{color:white;font-weight:900;font-size:1.1rem;text-decoration:none}.hdr-logo span{color:#fdd835}
        .hdr-back{margin-left:auto;color:rgba(255,255,255,.8);font-size:.8rem;text-decoration:none;padding:6px 14px;border:1px solid rgba(255,255,255,.25);border-radius:6px}
        .wrap{width:100%;max-width:560px;margin-top:56px}
        .card{background:white;border-radius:20px;padding:40px;box-shadow:0 8px 40px rgba(26,35,126,.12);margin-bottom:16px}
        h1{font-size:1.6rem;font-weight:900;color:#1a237e;margin-bottom:6px;letter-spacing:-.5px}
        .sub{color:#888;font-size:.86rem;margin-bottom:28px;line-height:1.6}
        .section{margin-bottom:28px}
        .section-title{font-size:.7rem;font-weight:800;color:#546e7a;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px}
        .btn-export{width:100%;padding:14px;background:linear-gradient(135deg,#1565c0,#6a1b9a);color:white;border:none;border-radius:12px;font-family:'Inter',sans-serif;font-weight:800;font-size:.95rem;cursor:pointer;box-shadow:0 4px 20px rgba(21,101,192,.3);letter-spacing:.3px;transition:all .2s}
        .btn-export:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(21,101,192,.4)}
        .drop-zone{border:2.5px dashed #c5cae9;border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;background:#f8f9ff}
        .drop-zone:hover{border-color:#1565c0;background:#e8eaf6}
        .drop-title{font-weight:700;color:#1a237e;margin-bottom:4px}
        .drop-sub{font-size:.78rem;color:#888}
        .status{padding:12px 16px;border-radius:10px;font-size:.84rem;font-weight:600;margin-top:16px;background:${status.startsWith('✅')?'#e8f5e9':'#ffebee'};color:${status.startsWith('✅')?'#2e7d32':'#c62828'};border:1px solid ${status.startsWith('✅')?'#a5d6a7':'#ef9a9a'}}
        .what-migrates{background:#f8f9ff;border:1px solid #e0e4ff;border-radius:10px;padding:14px 16px;font-size:.78rem;color:#546e7a;line-height:2}
        .wm-item{display:flex;align-items:center;gap:8px}
        .wm-dot{width:6px;height:6px;border-radius:50%;background:#1565c0;flex-shrink:0}
      `}</style>
      <header className="hdr">
        <a href="/" className="hdr-logo">Test<span>Zyro</span></a>
        <a href="/" className="hdr-back">← Back</a>
      </header>
      <div className="wrap">
        <div className="card">
          <h1>Device Migration</h1>
          <p className="sub">Export all your TestZyro data (test attempts, bookmarks, saved tests) and import it on a new device or browser.</p>

          <div className="section">
            <div className="section-title">What gets migrated</div>
            <div className="what-migrates">
              {['Saved test attempts & scores','Bookmarked questions & notebooks','Saved/uploaded test files','App preferences (dark mode etc.)'].map(i=>(
                <div key={i} className="wm-item"><div className="wm-dot"/>{i}</div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-title">Step 1 — Export from this device</div>
            <button className="btn-export" onClick={exportAll}>Download Backup File</button>
          </div>

          <div className="section">
            <div className="section-title">Step 2 — Import on new device</div>
            <label className="drop-zone" style={{display:'block'}}>
              <div style={{fontSize:'2rem',marginBottom:8}}>📂</div>
              <div className="drop-title">{importing ? 'Importing…' : 'Click to select backup file'}</div>
              <div className="drop-sub">Select the .json file you exported</div>
              <input type="file" accept=".json" style={{display:'none'}} onChange={e=>{if(e.target.files[0])importAll(e.target.files[0])}}/>
            </label>
          </div>

          {status && <div className="status">{status}</div>}
        </div>
      </div>
    </>
  )
}
