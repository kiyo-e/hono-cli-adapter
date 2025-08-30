import { Hono } from 'hono'
import { z } from 'zod'

/** ----------------------------------------------------------------
 * Slack client (form 統一・ノーリトライ) —— データを返す
 * ---------------------------------------------------------------- */
function toFormValue(v) {
  if (v == null) return undefined
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

async function slackData(method, params, token) {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) {
    const enc = toFormValue(v)
    if (enc !== undefined) body.append(k, enc)
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
  // Slack が非200時も JSON を返すことが多いが、保険でキャッチ
  return await res.json().catch(() => ({ ok: false, error: `http_${res.status}` }))
}

/** ----------------------------------------------------------------
 * Hono app
 * - POST-only
 * - query + body(JSON/FORM) をマージして rawParams に
 * - トークン注入（env のみを一次情報とする：SLACK_USER_TOKEN / SLACK_BOT_TOKEN）
 * - ルートごとに app.use('/path', useToken(), validateMerged(schema))
 * ---------------------------------------------------------------- */
const app = new Hono()

// 0) POST 以外は 405
app.use('*', async (c, next) => {
  if (c.req.method !== 'POST') {
    return c.json({ ok: false, error: 'method_not_allowed', hint: 'Use POST' }, 405)
  }
  await next()
})

// 1) query + body をマージ
app.use('*', async (c, next) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams.entries())
  let body = {}
  const ct = c.req.header('content-type') || ''
  try {
    if (ct.includes('application/json')) {
      body = await c.req.json()
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const sp = new URLSearchParams(await c.req.text())
      body = Object.fromEntries(sp.entries())
    }
  } catch {
    // ボディ無し・不正は空扱い
  }
  c.set('rawParams', { ...query, ...body })
  await next()
})

// 2) トークン注入（env → c.env は adapter がマージしてくれる）
const useToken = (pref = 'bot') => async (c, next) => {
  const user = c.env?.SLACK_USER_TOKEN
  const bot  = c.env?.SLACK_BOT_TOKEN
  const token = pref === 'user' ? user : (pref === 'bot' ? bot : (user || bot))
  if (!token) return c.json({ ok: false, error: 'no_token' }, 400)
  c.set('authToken', token)
  await next()
}

// 3) Zod で rawParams を検証 → c.get('p') に格納
const validateMerged = (schema) => async (c, next) => {
  const raw = c.get('rawParams') || {}
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.flatten()
    return c.json({ ok: false, error: 'invalid_params', details }, 400)
    // details.fieldErrors に各項目のメッセージが入ります
  }
  c.set('p', parsed.data)
  await next()
}

/** ----------------------------------------------------------------
 * Zod Schemas
 * ---------------------------------------------------------------- */
const SWhoami = z.object({})

const SPost = z.object({
  channel: z.string().min(1),
  text: z.string().optional(),
  thread_ts: z.union([z.string(), z.number()]).optional()
    .transform(v => (v == null ? undefined : String(v)))
})

const SThreadGet = z.object({
  channel: z.string().min(1),
  ts: z.union([z.string(), z.number()]).transform(v => String(v))
})

const SFilesList = z.object({
  channel: z.string().min(1),
  count: z.union([z.string(), z.number()]).optional()
    .transform(v => (v == null ? undefined : String(v)))
})

const SFilesDownload = z.object({
  file_id: z.string().min(1),
  out: z.string().min(1)
})

const SUpload = z.object({
  channel: z.string().min(1),
  file: z.string().min(1),
  title: z.string().optional(),
  comment: z.string().optional(),
  thread_ts: z.union([z.string(), z.number()]).optional()
    .transform(v => (v == null ? undefined : String(v)))
})

/** ----------------------------------------------------------------
 * Routes（全部 POST）
 *   app.use('/path', useToken(...), validateMerged(schema)) → handler は薄く
 * ---------------------------------------------------------------- */

// /whoami -> auth.test
app.use('/whoami', useToken('bot'), validateMerged(SWhoami))
app.post('/whoami', async (c) => {
  const data = await slackData('auth.test', {}, c.get('authToken'))
  return c.json(data, data.ok ? 200 : 400)
})

// /post -> chat.postMessage
app.use('/post', useToken('bot'), validateMerged(SPost))
app.post('/post', async (c) => {
  const p = c.get('p')
  const data = await slackData('chat.postMessage',
    { channel: p.channel, text: p.text ?? '', thread_ts: p.thread_ts },
    c.get('authToken')
  )
  return c.json(data, data.ok ? 200 : 400)
})

// /thread.get -> conversations.replies
app.use('/thread.get', useToken('any'), validateMerged(SThreadGet))
app.post('/thread.get', async (c) => {
  const p = c.get('p')
  const data = await slackData('conversations.replies',
    { channel: p.channel, ts: p.ts },
    c.get('authToken')
  )
  return c.json(data, data.ok ? 200 : 400)
})

// /files.list -> files.list
app.use('/files.list', useToken('bot'), validateMerged(SFilesList))
app.post('/files.list', async (c) => {
  const p = c.get('p')
  const data = await slackData('files.list',
    { channel: p.channel, count: p.count ?? '20' },
    c.get('authToken')
  )
  return c.json(data, data.ok ? 200 : 400)
})

// /files.download -> files.info で URL を取り、署名URLからGET、ローカル保存
app.use('/files.download', useToken('any'), validateMerged(SFilesDownload))
app.post('/files.download', async (c) => {
  const p = c.get('p')

  const info = await slackData('files.info', { file: p.file_id }, c.get('authToken'))
  if (!info.ok) return c.json(info, 400)
  const url = info.file?.url_private_download
  if (!url) return c.json({ ok: false, error: 'no_download_url' }, 400)

  const bin = await fetch(url, { headers: { Authorization: `Bearer ${c.get('authToken')}` } })
  if (!bin.ok) return c.json({ ok: false, error: `download_http_${bin.status}` }, 400)

  const buf = Buffer.from(await bin.arrayBuffer())
  const fs = await import('node:fs')
  fs.writeFileSync(p.out, buf)
  return c.json({ ok: true, path: p.out })
})

// /upload -> external upload 手順 (Step1: URL発行, Step2: multipart 直PUT/POST, Step3: 完了共有)
app.use('/upload', useToken('bot'), validateMerged(SUpload))
app.post('/upload', async (c) => {
  const p = c.get('p')
  const fs = await import('node:fs')
  const name = p.title || String(p.file).split('/').pop()
  const size = fs.statSync(p.file).size

  // Step1: 署名URL発行（form）
  const step1 = await slackData('files.getUploadURLExternal', { filename: name, length: size }, c.get('authToken'))
  if (!step1.ok) return c.json(step1, 400)

  // Step2: 署名URLへ multipart で本体アップロード（Slack APIではなくストレージURL）
  const fd = new FormData()
  fd.append('filename', new Blob([fs.readFileSync(p.file)]), name)
  const up = await fetch(step1.upload_url, { method: 'POST', body: fd })
  if (!up.ok) return c.json({ ok: false, error: `upload_http_${up.status}` }, 400)

  // Step3: 完了・共有（form）
  const finalize = await slackData('files.completeUploadExternal', {
    channel_id: p.channel,
    files: [{ id: step1.file_id, title: name }],
    initial_comment: p.comment,
    thread_ts: p.thread_ts
  }, c.get('authToken'))

  return c.json(finalize, finalize.ok ? 200 : 400)
})

export default app
