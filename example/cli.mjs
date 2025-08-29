#!/usr/bin/env node
import minimist from 'minimist'
import { adaptAndFetch, listGetRoutes } from '../dist/index.js'
import app from './app.mjs'

const argvRaw = process.argv.slice(2)
const argv = minimist(argvRaw, {
  boolean: ['json', 'list'],
  string: ['base', 'env'],
  alias: { j: 'json', e: 'env' },
  '--': true
})

if (argv.list) {
  for (const p of listGetRoutes(app)) console.log(`GET ${p}`)
  process.exit(0)
}

const { res } = await adaptAndFetch(app, argvRaw, {
  base: argv.base,
  reservedKeys: ['json', 'list']
})

if (argv.json) {
  const text = await res.text()
  try {
    console.log(JSON.stringify({ status: res.status, data: JSON.parse(text) }, null, 2))
  } catch {
    console.log(JSON.stringify({ status: res.status, data: text }, null, 2))
  }
} else {
  console.log(await res.text())
}

process.exit(res.ok ? 0 : 1)

