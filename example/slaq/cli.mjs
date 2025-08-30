#!/usr/bin/env node
import { runCliAndExit } from 'hono-cli-adapter'
import app from './app.mjs'

// --list / --help / --json / --env は adapter 側が面倒見ます
await runCliAndExit(app, process.argv.slice(2))
