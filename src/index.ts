import minimist from 'minimist'

type AnyObj = Record<string, unknown>

export type AdapterOptions = {
  /** Base path to prefix to argv path segments (e.g. /v1). */
  base?: string
  /** Env object passed to app.fetch (merged with --env if provided). */
  env?: Record<string, unknown>
  /** Keys that should NOT be placed into query string (CLI-only flags). */
  reservedKeys?: string[]
}

const DEFAULT_RESERVED = new Set(['_', '--', 'base', 'env'])

/**
 * Roughly list GET routes from a Hono app.
 * Note: this relies on Hono's internal shape (best-effort snapshot).
 */
export function listGetRoutes(app: any): string[] {
  const routes = (app as any)?.routes ?? []
  return routes.filter((r: any) => r?.method === 'GET').map((r: any) => r.path)
}

/**
 * Build a URL from parsed argv.
 */
export function buildUrlFromArgv(
  argv: minimist.ParsedArgs,
  options?: AdapterOptions
): URL {
  const base = options?.base ?? ''
  const segs = (argv._ as (string | number | boolean)[])
    .filter((s) => s !== undefined && s !== null)
    .map((s) => encodeURIComponent(String(s)))

  const join = (...parts: string[]) =>
    parts
      .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/')

  const pathname = '/' + join(base, ...segs)

  const qs = new URLSearchParams()
  const reserved = new Set([...(options?.reservedKeys ?? []), ...DEFAULT_RESERVED])

  for (const [k, v] of Object.entries(argv as AnyObj)) {
    if (reserved.has(k)) continue
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, String(vv)))
    else if (typeof v === 'boolean') qs.set(k, String(v))
    else if (v != null) qs.set(k, String(v))
  }

  const url = new URL('http://cli')
  url.pathname = pathname
  const q = qs.toString()
  if (q) url.search = q
  return url
}

/**
 * Parse --env KEY=VALUE flags into an object (supports multiple occurrences).
 */
export function parseEnvFlags(
  envFlags: string | string[] | undefined
): Record<string, string> {
  const pairs = ([] as string[]).concat(envFlags || [])
  return Object.fromEntries(
    pairs.map((s) => {
      const i = s.indexOf('=')
      return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]
    })
  )
}

/**
 * Create a Request from argv (method fixed to GET).
 */
export function buildRequestFromArgv(
  argv: minimist.ParsedArgs,
  options?: AdapterOptions
): Request {
  const url = buildUrlFromArgv(argv, options)
  return new Request(url, { method: 'GET' })
}

/**
 * Run app.fetch and return { req, res } without touching stdout.
 */
export async function adaptAndFetch(
  app: any,
  argvRaw: string[] = process.argv.slice(2),
  options?: AdapterOptions
): Promise<{ req: Request; res: Response }> {
  const argv = minimist(argvRaw, {
    string: ['base', 'env'],
    alias: { e: 'env' },
    '--': true
  })

  const req = buildRequestFromArgv(argv, options)
  const envFromFlags = parseEnvFlags(argv.env)
  const mergedEnv = { ...(options?.env ?? {}), ...envFromFlags }
  const res = await app.fetch(req, mergedEnv)
  return { req, res }
}

