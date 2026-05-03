import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { verifyAdminToken } from '../../../lib/auth'

export const config = { api: { bodyParser: false } }

const OPT_MAP = { '1':'A', '2':'B', '3':'C', '4':'D' }

// Preferred display order — covers old and new subject names
const SUBJ_DISPLAY = {
  'Mathematics': 'Maths',
  'Maths': 'Maths',
  'Physics': 'Physics',
  'Chemistry': 'Chemistry',
  'English & LR': 'English & LR',
  'Biology': 'Biology',
}

const SUBJ_ORDER = ['Physics','Chemistry','English & LR','Mathematics','Maths','Biology']

function processZip(zipPath, testName, folder) {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()

  // Find data.json
  const dataEntry = entries.find(e => e.entryName.replace(/^.*\//, '') === 'data.json')
  if (!dataEntry) throw new Error('data.json not found in zip')
  const data = JSON.parse(dataEntry.getData().toString('utf8'))

  const pcd = data.pdfCropperData
  const ak  = data.testAnswerKey
  if (!pcd || !ak) throw new Error('Invalid format: missing pdfCropperData or testAnswerKey')

  // Build image map: "Subject__--__qnum__--__idx" -> base64
  const imageMap = {}
  for (const entry of entries) {
    const name = entry.entryName.replace(/^.*\//, '')
    if (!/\.(png|jpg|jpeg)$/i.test(name)) continue
    const key = name.replace(/\.(png|jpg|jpeg)$/i, '')
    imageMap[key] = entry.getData().toString('base64')
  }

  // Sort subjects in preferred order, unknown subjects appended after
  const rawSubjects = Object.keys(pcd)
  const orderedSubjects = [
    ...SUBJ_ORDER.filter(s => rawSubjects.includes(s)),
    ...rawSubjects.filter(s => !SUBJ_ORDER.includes(s))
  ]

  const questions = []

  for (const subj of orderedSubjects) {
    if (!pcd[subj]) continue
    const subjData = pcd[subj]
    const displaySubj = SUBJ_DISPLAY[subj] || subj

    for (const [sectionName, sectionQs] of Object.entries(subjData)) {
      const ansSection = (ak[subj] || {})[sectionName] || {}
      const sortedKeys = Object.keys(sectionQs).sort((a,b) => parseInt(a)-parseInt(b))

      for (const qnumStr of sortedKeys) {
        const q = sectionQs[qnumStr]
        const originalQnum = parseInt(qnumStr)

        // Handle both answer formats:
        // New: { correctAnswer: [2] }  (array of option numbers)
        // Old: "2" or 2               (plain number/string)
        const ansRaw = ansSection[qnumStr]
        let ansLetter = ''
        if (ansRaw) {
          if (typeof ansRaw === 'object' && ansRaw.correctAnswer) {
            // New format: { type, answerOptions, correctAnswer: [2] }
            const num = ansRaw.correctAnswer?.[0]
            ansLetter = OPT_MAP[String(num)] || String(num)
          } else if (typeof ansRaw === 'number' || typeof ansRaw === 'string') {
            // Old format: plain number or string
            ansLetter = OPT_MAP[String(ansRaw)] || String(ansRaw)
          }
        }

        // Collect images — try both subject name variations
        const images = []
        const imgSubjKeys = [subj, displaySubj]
        for (const imgSubj of imgSubjKeys) {
          if (images.length > 0) break
          for (let i = 1; i <= 10; i++) {
            const key = `${imgSubj}__--__${qnumStr}__--__${i}`
            if (imageMap[key]) images.push(imageMap[key])
            else break
          }
        }

        const numOpts = parseInt(q.answerOptions) || 4
        const opts = ['A','B','C','D'].slice(0, numOpts)

        questions.push({
          qnum: originalQnum,   // preserve original number
          subject: displaySubj,
          type: q.type === 'mcq' ? 'MCQ' : 'INTEGER',
          opts,
          ans: ansLetter,
          images,
          mCor: q.marks?.cm || 3,
          mNeg: Math.abs(q.marks?.im || 1),
        })
      }
    }
  }

  if (questions.length === 0) throw new Error('No questions found in zip')

  // Detect exam type from subjects
  const subjects = [...new Set(questions.map(q => q.subject))]
  const isBitsat = subjects.includes('Physics') && subjects.includes('Chemistry')
  const subject = isBitsat ? 'BITSAT' : (folder || subjects[0] || 'Exam')

  return {
    id: subject.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now(),
    title: testName,
    subject,
    dur: 180,
    mCor: 3,
    mNeg: 1,
    questions
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const tok = req.headers.authorization?.replace('Bearer ','')
  if (!verifyAdminToken(tok)) return res.status(401).json({ error: 'Unauthorized' })

  const form = new IncomingForm({ uploadDir:'/tmp', keepExtensions:true, maxFileSize:200*1024*1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload failed: ' + err.message })

    const file = Array.isArray(files.zip) ? files.zip[0] : files.zip
    if (!file) return res.status(400).json({ error: 'No zip file' })

    const testName = Array.isArray(fields.testName) ? fields.testName[0] : (fields.testName || 'Test')
    const folder   = Array.isArray(fields.folder) ? fields.folder[0] : (fields.folder || 'BITSAT 1')

    try {
      const testData = processZip(file.filepath || file.path, testName, folder)

      // Save to Supabase Storage via public/tests path (for local) OR upload directly
      // For Vercel we save to /tmp then upload to Supabase Storage
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

      if (sbUrl && sbKey) {
        // Upload to Supabase Storage
        const safeName = testName.replace(/[^a-zA-Z0-9_\-\s]/g,'').replace(/\s+/g,'_') + '.json'
        const storagePath = `${folder}/${safeName}`
        const jsonBuffer = Buffer.from(JSON.stringify(testData))

        const uploadRes = await fetch(`${sbUrl}/storage/v1/object/tests/${storagePath}`, {
          method: 'POST',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
            'x-upsert': 'true'
          },
          body: jsonBuffer
        })

        try { fs.unlinkSync(file.filepath || file.path) } catch(e) {}

        if (!uploadRes.ok) {
          const errText = await uploadRes.text()
          return res.status(500).json({ error: 'Storage upload failed: ' + errText })
        }

        return res.status(200).json({
          ok: true,
          path: `__storage__${storagePath}`,
          questions: testData.questions.length,
          title: testName,
          folder
        })
      } else {
        // Fallback: save locally
        const testsBase = path.join(process.cwd(), 'public', 'tests', folder)
        fs.mkdirSync(testsBase, { recursive: true })
        const safeName = testName.replace(/[^a-zA-Z0-9_\-\s]/g,'').replace(/\s+/g,'_') + '.json'
        const dest = path.join(testsBase, safeName)
        fs.writeFileSync(dest, JSON.stringify(testData, null, 2), 'utf8')
        try { fs.unlinkSync(file.filepath || file.path) } catch(e) {}
        return res.status(200).json({ ok: true, path: `${folder}/${safeName}`, questions: testData.questions.length, title: testName })
      }
    } catch(e) {
      try { fs.unlinkSync(file.filepath || file.path) } catch(e2) {}
      res.status(500).json({ error: e.message })
    }
  })
}
