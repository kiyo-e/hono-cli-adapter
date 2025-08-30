#!/usr/bin/env node
import { runCliAndExit } from '../dist/index.js'
import app from './app.mjs'

await runCliAndExit(app, process.argv.slice(2))
