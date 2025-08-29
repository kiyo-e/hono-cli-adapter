#!/usr/bin/env node
import { runCliDefault } from '../dist/index.js'
import app from './app.mjs'

const { code, lines } = await runCliDefault(app, process.argv.slice(2))
for (const l of lines) console.log(l)
process.exit(code)
