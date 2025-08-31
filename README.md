# hono-cli-adapter

Tiny library to adapt CLI arguments into a POST request for a Hono app — without touching stdout. It lets you build a small custom CLI around an existing Hono application, while keeping this package a pure, testable library.

Status: minimal but usable. ESM-only.

## Why
- Keep your CLI thin: printing, JSON formatting, and flags live in your own small bin.
- Library has no side effects: never writes to stdout/stderr.
- Strong constraints: POST-only philosophy for predictable calls from the shell.
- Reserved flags: easily exclude your CLI-only flags from HTTP query strings.
 - Default env: `process.env` is merged by default.
 - Env merging: combine `process.env` + `options.env` + repeated `--env KEY=VALUE` flags (later wins).
- Body tokens: pass `-- key=value` pairs to send JSON payloads.

## Install
```
npm install hono-cli-adapter
```

Peer/runtime expectations:
- Node 18+ (global WHATWG `fetch`)
- Hono app instance with `app.fetch(req, env)` available

## Quick Start
Create a tiny CLI that wraps your existing Hono app. Your CLI controls output and flags; the adapter only builds the request and calls `app.fetch`.

```ts
#!/usr/bin/env node
// my-cli.ts (ESM)
import { runCliDefault } from 'hono-cli-adapter'
import { app } from './dist/app.js' // your Hono app export

const { code, lines } = await runCliDefault(app, process.argv.slice(2))
for (const l of lines) console.log(l)
process.exit(code)
```

Ultra‑simple (one‑liner) bin using the convenience wrapper that prints and exits for you:

```ts
#!/usr/bin/env node
import { runCliAndExit } from 'hono-cli-adapter'
import { app } from './dist/app.js'

await runCliAndExit(app, process.argv.slice(2))
```

## API
Exported from `src/index.ts:1`:

```ts
type AdapterOptions = {
  base?: string
  env?: Record<string, unknown>
  reservedKeys?: string[]
  beforeFetch?:
    | ((req: Request, argv: minimist.ParsedArgs) => Promise<Request | void> | Request | void)
    | Record<string, (req: Request, argv: minimist.ParsedArgs) => Promise<Request | void> | Request | void>
}

function listPostRoutes(app: any): string[]
function buildUrlFromArgv(argv: minimist.ParsedArgs, options?: AdapterOptions): URL
function parseEnvFlags(envFlags: string | string[] | undefined): Record<string, string>
function parseBodyTokens(tokens: string | string[] | undefined): Record<string, string>
function buildRequestFromArgv(argv: minimist.ParsedArgs, options?: AdapterOptions): Request
function commandFromArgv(argv: minimist.ParsedArgs, options?: AdapterOptions): string | undefined
function adaptAndFetch(
  app: any,
  argvRaw?: string[] /* defaults to process.argv.slice(2) */,
  options?: AdapterOptions
): Promise<{ req: Request; res: Response }>
// New helpers (no stdout)
function routePathToCommandSegments(routePath: string): string[]
function buildCommandExample(routePath: string, cmdBase: string): string
function buildCommandExamples(routes: string[], cmdBase: string): string[]
function detectCommandBase(argv0?: string, argv1?: string): string
function listRoutesWithExamples(app: any, cmdBase?: string): { routes: string[]; examples: string[] }
function listCommandExamples(app: any, cmdBase?: string): string[]
type RunCliResult = { code: number; lines: string[]; req?: Request; res?: Response }
function runCliDefault(app: any, argvRaw?: string[], options?: AdapterOptions): Promise<RunCliResult>
// Convenience with side effects (stdout + process.exit when available)
function runCliAndExit(app: any, argvRaw?: string[], options?: AdapterOptions): Promise<number>
```

Key behaviors:
- Reserved keys default to `['_', '--', 'base', 'env']` and are removed from the query string. Add your own via `options.reservedKeys`.
- Environment precedence when calling `app.fetch(req, env)`:
  1) `process.env` (base, included by default)
  2) `options.env` (overrides base)
  3) `--env KEY=VALUE` flags (highest precedence)
- Tokens after `--` like `key=value` become a JSON body.
- `buildRequestFromArgv` and `adaptAndFetch` use POST only.
- `listPostRoutes` is best-effort and relies on Hono’s internal shape. It enumerates POST paths only.

## Usage Patterns
Two ways to integrate:

1) High-level (simplest): let the adapter parse `argvRaw` for the common flags `--base`, `--env`.
```ts
const { res } = await adaptAndFetch(app, process.argv.slice(2), { reservedKeys: ['json'] })
```

2) Lower-level: parse your own flags, then build the request yourself.
```ts
import minimist from 'minimist'
import { buildRequestFromArgv, parseEnvFlags, listRoutesWithExamples, detectCommandBase } from 'hono-cli-adapter'

const argv = minimist(process.argv.slice(2), { string: ['env'], '--': true })
const req = buildRequestFromArgv(argv, { base: '/v1', reservedKeys: ['json'] })
const res = await app.fetch(req, { ...parseEnvFlags(argv.env) })

// Show routes plus runnable examples (you print; library does not):
const { routes, examples } = listRoutesWithExamples(app, detectCommandBase())
console.log('POST routes:')
for (const p of routes) console.log('  POST ' + p)
console.log('\nCommand examples:')
for (const ex of examples) console.log('  ' + ex)
```

### Hooks and command detection

Tweak the outgoing `Request` before sending:

```ts
import fs from 'node:fs/promises'
import minimist from 'minimist'
import { adaptAndFetch, commandFromArgv } from 'hono-cli-adapter'

const argv = minimist(process.argv.slice(2), { '--': true })
const cmd = commandFromArgv(argv) // safe: no direct argv._ access

await adaptAndFetch(app, process.argv.slice(2), {
  beforeFetch: {
    upload: async (req, argv) => {
      if (argv.file) {
        const buf = await fs.readFile(argv.file)
        const headers = new Headers(req.headers)
        headers.set('content-type', 'application/octet-stream')
        return new Request(req, { body: buf, headers })
      }
    }
  }
})
```

## Example Projects
This repo ships runnable examples:
- `example/basic/` — minimal Hono app + CLI (`example/basic/README.md`)
- `example/slaq/` — Slack-focused CLI example built on this adapter

Quick taste:
```
npm run build
node example/basic/cli.mjs --list   # prints runnable command examples only
node example/basic/cli.mjs --help   # same as --list
node example/basic/cli.mjs hello Taro         # -> "Hello, Taro!"
node example/basic/cli.mjs env API_KEY --env API_KEY=secret-123   # -> "API_KEY=secret-123"
```

Single-file binary via Bun:
```
npm run build:example:bin
./example/basic/bin/hono-example --list
./example/basic/bin/hono-example --help
```

## Design Notes
- POST-only now; adding other methods can be an additive future feature when/if needed.
- The adapter never writes to stdout — your CLI formats results (plain text, JSON, etc.).
- Use `reservedKeys` to prevent your CLI flags (e.g. `--json`, `--list`) from leaking into HTTP queries.

## Compatibility
- ESM only. If you need CJS, transpile on your side.
- Node 18+ recommended. If you don’t have global `fetch`, polyfill (e.g. `undici`).

## Caveats
- `listPostRoutes` depends on Hono internals and may break if they change. Consider maintaining your own list if you need strong guarantees.

## Development
```
npm i
npm run build
```

That’s it — minimal surface, focused on the adapter behavior.

## License
MIT © K.Endo
