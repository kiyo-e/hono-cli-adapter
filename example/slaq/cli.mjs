#!/usr/bin/env node
import { runCliAndExit } from '../../dist/index.js'
import app from './app.mjs'

// adapter handles --list / --help / --json / --env
await runCliAndExit(app, process.argv.slice(2))
