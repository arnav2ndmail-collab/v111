import Head from 'next/head'
import Nav from '../components/Nav'

export default function SubmitTest() {
  return (
    <>
      <Head><title>Add Your Test — Karle</title></Head>
      <Nav/>
      <div style={{minHeight:'100vh',background:'#0a0e1a',padding:'48px 20px',fontFamily:"'Inter',sans-serif"}}>
        <div style={{maxWidth:680,margin:'0 auto'}}>

          {/* Header */}
          <div style={{textAlign:'center',marginBottom:48}}>
            <div style={{width:64,height:64,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:'1.8rem'}}>✍️</div>
            <h1 style={{fontSize:'2rem',fontWeight:900,color:'#e2e8f0',margin:'0 0 10px'}}>Add Your Test</h1>
            <p style={{color:'#64748b',fontSize:'1rem',margin:0,lineHeight:1.6}}>Create your own CBT-style mock test and share it with everyone on Karle</p>
          </div>

          {/* Step 1 — Builder */}
          <div style={{background:'#141927',border:'1px solid #2d3748',borderRadius:16,padding:'28px 32px',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
              <div style={{width:36,height:36,background:'#6366f1',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.9rem',color:'white',flexShrink:0}}>1</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:'1.05rem',color:'#e2e8f0',marginBottom:6}}>Build your test</div>
                <p style={{color:'#64748b',fontSize:'.88rem',lineHeight:1.7,margin:'0 0 16px'}}>
                  Use our free test builder to create your question paper. Add questions, images, options, and correct answers. Export it as a <code style={{background:'#1e293b',padding:'1px 6px',borderRadius:4,color:'#a5b4fc',fontSize:'.82rem'}}>.json</code> file when done. Tutorial: https://drive.google.com/file/d/1CkOslr0HgkhlxleSfI6UIbIuW7Qc5QIB/view?usp=sharing
                </p>
                <a href="https://builer.onrender.com/" target="_blank" rel="noopener noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:8,background:'#6366f1',color:'white',padding:'10px 22px',borderRadius:9,fontWeight:700,fontSize:'.85rem',textDecoration:'none',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#4f46e5'}
                  onMouseLeave={e=>e.currentTarget.style.background='#6366f1'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Open Test Builder →
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 — Send */}
          <div style={{background:'#141927',border:'1px solid #2d3748',borderRadius:16,padding:'28px 32px',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
              <div style={{width:36,height:36,background:'#8b5cf6',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.9rem',color:'white',flexShrink:0}}>2</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:'1.05rem',color:'#e2e8f0',marginBottom:6}}>Send it to us</div>
                <p style={{color:'#64748b',fontSize:'.88rem',lineHeight:1.7,margin:'0 0 20px'}}>
                  Once your <code style={{background:'#1e293b',padding:'1px 6px',borderRadius:4,color:'#a5b4fc',fontSize:'.82rem'}}>.json</code> file is ready, send it through any of the channels below. We'll review it and add it to the library for everyone.
                </p>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {/* Telegram */}
                  <a href="https://t.me/toopixel" target="_blank" rel="noopener noreferrer"
                    style={{display:'flex',alignItems:'center',gap:14,background:'#1e293b',border:'1px solid #334155',borderRadius:12,padding:'14px 18px',textDecoration:'none',transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#0ea5e9'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#334155'}>
                    <div style={{width:40,height:40,background:'#0ea5e9',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 14.26l-2.974-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.002.299z"/></svg>
                    </div>
                    <div>
                      <div style={{fontWeight:700,color:'#e2e8f0',fontSize:'.88rem'}}>Telegram</div>
                      <div style={{color:'#0ea5e9',fontSize:'.78rem',fontWeight:600}}>@toopixel</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{marginLeft:'auto'}}><polyline points="9 18 15 12 9 6"/></svg>
                  </a>

                  {/* Reddit */}
                  <a href="https://www.reddit.com/user/AffectionateFloor607/" target="_blank" rel="noopener noreferrer"
                    style={{display:'flex',alignItems:'center',gap:14,background:'#1e293b',border:'1px solid #334155',borderRadius:12,padding:'14px 18px',textDecoration:'none',transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#f97316'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#334155'}>
                    <div style={{width:40,height:40,background:'#f97316',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                    </div>
                    <div>
                      <div style={{fontWeight:700,color:'#e2e8f0',fontSize:'.88rem'}}>Reddit</div>
                      <div style={{color:'#f97316',fontSize:'.78rem',fontWeight:600}}>u/AffectionateFloor607</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{marginLeft:'auto'}}><polyline points="9 18 15 12 9 6"/></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div style={{background:'#141927',border:'1px solid #2d3748',borderRadius:16,padding:'28px 32px',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
              <div style={{width:36,height:36,background:'#10b981',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.9rem',color:'white',flexShrink:0}}>💡</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:'1.05rem',color:'#e2e8f0',marginBottom:12}}>Tips for a good submission</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    ['📋','Include the exam name and year in the title (e.g. "BITSAT 2024 Mock 3")'],
                    ['✅','Double-check all correct answers before sending'],
                    ['🖼️','Use the builder\'s image upload if questions have diagrams'],
                    ['📂','You can send multiple tests — just zip them and send the folder'],
                    ['⚡','Telegram is fastest for a response — usually within a day'],
                  ].map(([ic,text],i)=>(
                    <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{fontSize:'.9rem',flexShrink:0,marginTop:1}}>{ic}</span>
                      <span style={{color:'#94a3b8',fontSize:'.84rem',lineHeight:1.6}}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <p style={{color:'#334155',fontSize:'.78rem',margin:0}}>
              All submitted tests are reviewed before being added to the library. We'll notify you once it's live! 🎉
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
