# slaq (Slack CLI example)

Small Slack CLI built with Hono and `hono-cli-adapter`. All routes are POST-only and parameters are validated with Zod. Slack API calls use form encoding (`application/x-www-form-urlencoded`). Bun can bundle it into a single-file binary.

> Note: the npm package name `slaq` already exists, so this example publishes as `slaq-cli`. You can run it with `npx slaq-cli` or `bunx slaq-cli`, but the executable itself is `slaq`.

## Requirements
- Node 18+ (for global `fetch`)
- Optional: Bun 1.1+ (for single-file binary)

## Install

```bash
npm i
```

## Usage

### List routes

```bash
node ./cli.mjs --list
# or
node ./cli.mjs --help
```

### Environment variables
- Required: `SLACK_BOT_TOKEN`
- Optional: `SLACK_USER_TOKEN` (for private channel access, etc.)

By default, `hono-cli-adapter` passes `process.env` into `app.fetch(req, env)`. You can still override or add values via:

- `--env KEY=VALUE` flags (highest precedence)
- `options.env` from your CLI code (middle)

Example: `node ./cli.mjs whoami --env SLACK_BOT_TOKEN=xoxb-***`

## Examples

```bash
# whoami
SLACK_BOT_TOKEN=xoxb-*** node ./cli.mjs whoami

# post message
node ./cli.mjs post -- channel=C123456 text="hi" thread_ts=1724952000.000000

# fetch thread
node ./cli.mjs thread.get -- channel=C123456 ts=1724952000.000000

# list files
node ./cli.mjs files.list -- channel=C123456 count=50

# download (save to local FS)
node ./cli.mjs files.download -- file_id=F12345 out=/abs/path/file.bin

# upload
node ./cli.mjs upload -- channel=C123456 file=/abs/path/file.pdf title=Report comment="Uploading"
```

Adding `--json` formats output as `{ status, data }` (adapter feature).

## Single-file binary with Bun

```bash
npm run build:bin
./bin/slaq --list
./bin/slaq whoami --env SLACK_BOT_TOKEN=xoxb-***
```

## Design notes
- POST-only for stable CLI calls
- Form encoding everywhere (objects such as blocks are JSON-stringified internally)
- Common logic collected via `app.use` (force POST, merge query+body, inject tokens)
- Zod validation (`app.use('/path', useToken(), validateMerged(schema))`)
- Thin handlers that simply `c.json` the Slack client data

Any extra seasoning should live on the CLI side, keeping upstream logic minimal.
