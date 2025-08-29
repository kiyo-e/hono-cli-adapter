import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello from Hono'))

app.get('/help', (c) => {
  const name = 'hono-example'
  const routes = (app?.routes ?? []).filter((r) => r?.method === 'GET')
  const lines = [
    'hono-cli-adapter example',
    '',
    `Usage: ${name} [segments...] [--json] [--list] [--base /v1] [--env KEY=VALUE]`,
    '',
    'GET routes:'
  ]
  for (const r of routes) lines.push(`  GET ${r.path}`)
  lines.push('')
  return c.text(lines.join('\n'))
})

app.get('/hello/:name', (c) => {
  const name = c.req.param('name')
  return c.json({ message: `Hello, ${name}!` })
})

app.get('/env/:key', (c) => {
  const key = c.req.param('key')
  const val = (c.env ?? {})[key]
  return c.json({ key, value: val ?? null })
})

export default app
