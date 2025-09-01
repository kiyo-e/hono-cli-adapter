# Repository Guidelines

## Project Structure & Module Organization
- `src/` (TypeScript, ESM): library source; entry is `src/index.ts`.
- `dist/` (build output): compiled `.js` and `.d.ts` files published to npm. Tests import from here.
- `test/` (Node test files): e.g., `test/index.test.js` exercising the built API.
- `example/` (usage): runnable demos (`basic/`, `slaq/`) and an optional Bun-compiled binary in `example/basic/bin/`.

## Build, Test, and Development Commands
- `npm run build`: compile TypeScript → `dist/` using `tsc` (Node 18+, ESM `NodeNext`).
- `node --test`: run tests with Node’s built-in runner. Build first: `npm run build && node --test`.
- `node example/basic/cli.mjs --list|--help`: explore CLI behavior locally.
- `npm run build:example:bin`: produce a single-file binary (Bun required) at `example/basic/bin/hono-example`.

## Coding Style & Naming Conventions
- TypeScript strict mode; ESM-only. Prefer named exports; avoid default exports.
- Indentation: 2 spaces; quotes: single; semicolons: omit (match existing code).
- Naming: `PascalCase` for types, `camelCase` for functions/vars, `SCREAMING_SNAKE_CASE` for constants.
- File layout: keep `src/index.ts` as the public surface. Add small modules when needed; keep imports ESM.

## Testing Guidelines
- Framework: `node:test` + `node:assert/strict`.
- Test against built output: `import … from '../dist/index.js'`.
- File pattern: place specs under `test/` as `*.test.js`.
- Determinism: no network or stdout side effects—library APIs are pure. Build before testing.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat: …`, `fix: …`, `refactor: …`, `docs: …`, `chore: …` (see history: e.g., `feat: show global flags in help`).
- Scope PRs narrowly; include a clear description, linked issues, and CLI/output snippets when relevant.
- Update docs (`README.md`, examples) whenever public API or flags change.
- CI-light project: run `npm run build` and `node --test` locally before requesting review.

## Architecture & Tips
- Purpose: adapt CLI argv into a POST `Request` for a Hono app. The library never writes to stdout; your CLI owns printing.
- Env precedence: `process.env` < `options.env` < repeated `--env KEY=VALUE` flags.
- Exclude CLI-only flags from query via `reservedKeys`; `runCli/cli` auto-reserve `json`, `list`, `help`, `base`, `env`.
