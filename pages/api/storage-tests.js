// pages/api/storage-tests.js
// Lists tests from Supabase Storage using the service role key (server-side only).
// Called by the frontend instead of hitting Supabase directly with the anon key.

export default async function handler(req, res) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Service role key — never exposed to the browser
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  if (!sbUrl || !sbKey) {
    return res.status(200).json({ folders: {}, tests: [] })
  }

  const BUCKET = 'tests'
  const headers = {
    apikey: sbKey,
    Authorization: `Bearer ${sbKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // Step 1 — list root with delimiter to get folders + root files
    const topRes = await fetch(`${sbUrl}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 200, offset: 0, prefix: '', delimiter: '/' }),
    })
    if (!topRes.ok) {
      const err = await topRes.text()
      return res.status(200).json({ folders: {}, tests: [], error: err })
    }

    const topItems = await topRes.json()
    const result = { folders: {}, tests: [] }

    for (const item of Array.isArray(topItems) ? topItems : []) {
      if (!item.name) continue

      const isFolder = !item.id // folders have no id in Supabase Storage list response
      const isJson = item.name.endsWith('.json')

      if (isFolder) {
        // Step 2 — list folder contents
        const folderName = item.name.replace(/\/$/, '')
        const subRes = await fetch(`${sbUrl}/storage/v1/object/list/${BUCKET}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ limit: 200, offset: 0, prefix: folderName + '/' }),
        })
        if (!subRes.ok) continue
        const subItems = await subRes.json()
        const jsonFiles = (Array.isArray(subItems) ? subItems : []).filter(
          (f) => f.name && f.name.endsWith('.json') && f.id
        )
        if (jsonFiles.length === 0) continue
        if (!result.folders[folderName]) result.folders[folderName] = { folders: {}, tests: [] }
        for (const sf of jsonFiles) {
          const publicUrl = `${sbUrl}/storage/v1/object/public/${BUCKET}/${folderName}/${sf.name}`
          result.folders[folderName].tests.push({
            title: sf.name.replace('.json', '').replace(/_/g, ' ').replace(/-/g, ' '),
            path: `__storage__${folderName}/${sf.name}`,
            id: `storage__${folderName}__${sf.name}`,
            subject: folderName,
            storageUrl: publicUrl,
          })
        }
      } else if (isJson && item.id) {
        // Root-level JSON file
        const publicUrl = `${sbUrl}/storage/v1/object/public/${BUCKET}/${item.name}`
        if (!result.folders['Tests']) result.folders['Tests'] = { folders: {}, tests: [] }
        result.folders['Tests'].tests.push({
          title: item.name.replace('.json', '').replace(/_/g, ' ').replace(/-/g, ' '),
          path: `__storage__${item.name}`,
          id: `storage__${item.name}`,
          subject: item.name.replace('.json',''),
          storageUrl: publicUrl,
        })
      }
    }

    return res.status(200).json(result)
  } catch (e) {
    return res.status(200).json({ folders: {}, tests: [], error: e.message })
  }
}
