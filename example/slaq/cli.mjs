#!/usr/bin/env node
import { runCliAndExit } from 'hono-cli-adapter'
import app from './app.mjs'

// adapter handles --list / --help / --json / --env
await runCliAndExit(app, process.argv.slice(2))
