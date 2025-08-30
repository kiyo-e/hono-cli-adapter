# Example (Bun-compiled CLI)

This example shows how to wire `hono-cli-adapter` to a tiny Hono app and compile it into a single executable using Bun.

## Prerequisites

- Node 18+ (for building the library)
- Bun 1.1+ installed (`bun --version`)

## Build the library

From the repo root:

```
npm install
npm run build
```

## Build a single-file binary with Bun

From the repo root, run:

```
npm run build:example:bin
```

This produces `example/basic/bin/hono-example`.

## Run the binary

```
./example/basic/bin/hono-example --list   # shows runnable command examples only
./example/basic/bin/hono-example --help   # same as --list
./example/basic/bin/hono-example hello Taro            # -> "Hello, Taro!"
./example/basic/bin/hono-example env API_KEY --env API_KEY=secret-123  # -> "API_KEY=secret-123"
./example/basic/bin/hono-example --base /v1
```

## What’s inside

- `example/basic/app.mjs` — minimal Hono app
- `example/basic/cli.mjs` — small CLI using `adaptAndFetch()`

Flags understood by the CLI:

- `--list` — print runnable command examples (derived from POST routes)
- `--help`, `-h` — same output as `--list`
- `--json` — JSON-format the response (best-effort). For text endpoints, it wraps text as `{ status, data }`.
- `--base` — prefix base path (e.g. `/v1`)
- `--env KEY=VALUE` — provide env for `app.fetch`
