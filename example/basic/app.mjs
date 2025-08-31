import { Hono } from 'hono'

const app = new Hono()

app.post('/', (c) => c.text('Hello from Hono'))

app.post('/help', (c) => {
  const name = 'hono-example'
  const routes = (app?.routes ?? []).filter((r) => r?.method === 'POST')
  const lines = [
    'hono-cli-adapter example',
    '',
    `Usage: ${name} [segments...] [--json] [--list] [--base /v1] [--env KEY=VALUE]`,
    '',
    'POST routes:'
  ]
  for (const r of routes) lines.push(`  POST ${r.path}`)
  lines.push('')
  return c.text(lines.join('\n'))
})

app.post('/hello/:name', (c) => {
  const name = c.req.param('name')
  return c.text(`Hello, ${name}!`)
})

app.post('/env/:key', (c) => {
  const key = c.req.param('key')
  const val = (c.env ?? {})[key]
  return c.text(`${key}=${val ?? ''}`)
})

export default app
