#!/usr/bin/env node
// Tokens after `--` default to key=value pairs and become a JSON body.
// Example: `node example/cli.mjs submit -- name=Taro age=4`
import { runCliAndExit } from '../dist/index.js'
import app from './app.mjs'

await runCliAndExit(app, process.argv.slice(2))
