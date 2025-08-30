import minimist from 'minimist'
import path from 'node:path'

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

/** Convert a route path into CLI tokens; `:name` -> `<name>` */
export function routePathToCommandSegments(routePath: string): string[] {
  const segs = String(routePath || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => (s.startsWith(':') ? `<${s.slice(1)}>` : s))
  return segs
}

/** Build a single command example line for a route. */
export function buildCommandExample(routePath: string, cmdBase: string): string {
  const segs = routePathToCommandSegments(routePath)
  return cmdBase + (segs.length ? ' ' + segs.join(' ') : '')
}

/** Build command examples for multiple routes. */
export function buildCommandExamples(routes: string[], cmdBase: string): string[] {
  return routes.map((p) => buildCommandExample(p, cmdBase))
}

/**
 * Detect a reasonable command base for examples.
 * - If running via Node/Bun script: returns `node relative/path.mjs` or `bun relative/path.mjs`.
 * - If running as a compiled binary: returns the binary name from execPath/argv0.
 */
export function detectCommandBase(
  argv0: string | undefined = typeof process !== 'undefined' ? process.argv?.[0] : undefined,
  argv1: string | undefined = typeof process !== 'undefined' ? process.argv?.[1] : undefined
): string {
  const runtime = path.basename(argv0 || '')
  const execBase = typeof process !== 'undefined' ? path.basename(process.execPath || '') : ''
  const scriptRel = argv1 ? path.relative(process.cwd?.() || '', argv1) : ''

  if (runtime === 'node') {
    return scriptRel ? `node ${scriptRel}` : 'node cli.mjs'
  }
  if (runtime === 'bun') {
    // If compiled with Bun, execPath is the binary; otherwise bun itself
    return execBase && execBase !== 'bun' ? execBase : (scriptRel ? `bun ${scriptRel}` : 'bun cli.mjs')
  }
  return runtime || execBase || 'hono-example'
}

/** Convenience: list GET routes and produce command examples. */
export function listRoutesWithExamples(app: any, cmdBase?: string): { routes: string[]; examples: string[] } {
  const routes = listGetRoutes(app)
  const base = cmdBase ?? detectCommandBase()
  const examples = buildCommandExamples(routes, base)
  return { routes, examples }
}

/** Convenience: produce only command examples for GET routes. */
export function listCommandExamples(app: any, cmdBase?: string): string[] {
  const base = cmdBase ?? detectCommandBase()
  return buildCommandExamples(listGetRoutes(app), base)
}

export type RunCliResult = {
  code: number
  lines: string[]
  req?: Request
  res?: Response
}

/**
 * Convenience: implement a default CLI behavior without touching stdout.
 * - If `--list` or `--help` is present: returns command examples only.
 * - Otherwise: fetches and returns response body (JSON pretty or text) as lines.
 *
 * Flags parsed here: `--list`, `--help`, `--json`, `--base`, `--env KEY=VALUE` (repeatable).
 * Any additional CLI-only flags should be excluded via `options.reservedKeys` if you pass them to adapt.
 */
export async function runCliDefault(
  app: any,
  argvRaw: string[] = typeof process !== 'undefined' ? process.argv.slice(2) : [],
  options?: AdapterOptions
): Promise<RunCliResult> {
  const argv = minimist(argvRaw, {
    boolean: ['json', 'list', 'help'],
    string: ['base', 'env'],
    alias: { h: 'help', e: 'env' },
    '--': true
  })

  if (argv.list || argv.help) {
    const lines = listCommandExamples(app, detectCommandBase())
    return { code: 0, lines }
  }

  const { req, res } = await adaptAndFetch(app, argvRaw, {
    base: argv.base,
    env: options?.env,
    reservedKeys: ['json', 'list', 'help', ...(options?.reservedKeys ?? [])]
  })

  // Default format: JSON pretty if requested and parsable, otherwise raw text.
  const text = await res.text()
  let lines: string[]
  if (argv.json) {
    try {
      const obj = JSON.parse(text)
      lines = [JSON.stringify({ status: res.status, data: obj }, null, 2)]
    } catch {
      lines = [JSON.stringify({ status: res.status, data: text }, null, 2)]
    }
  } else {
    lines = [text]
  }

  return { code: res.ok ? 0 : 1, lines, req, res }
}

/**
 * Convenience: run the default CLI behavior and handle side effects.
 * - Prints each output line to stdout.
 * - Exits the process with the derived exit code when available.
 *
 * Keeps the core `runCliDefault` pure while offering a one-liner entrypoint
 * for bin scripts. If `process` is unavailable (non-Node runtimes), printing
 * falls back to `console.log` and no forced exit is attempted.
 */
export async function runCliAndExit(
  app: any,
  argvRaw: string[] = typeof process !== 'undefined' ? process.argv.slice(2) : [],
  options?: AdapterOptions
): Promise<number> {
  const { code, lines } = await runCliDefault(app, argvRaw, options)

  const hasStdout = typeof process !== 'undefined' && (process as any).stdout &&
    typeof (process as any).stdout.write === 'function'

  if (hasStdout) {
    for (const l of lines) (process as any).stdout.write(String(l) + '\n')
  } else {
    for (const l of lines) console.log(String(l))
  }

  if (typeof process !== 'undefined' && typeof (process as any).exit === 'function') {
    ;(process as any).exit(code)
  }
  return code
}
