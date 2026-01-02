#!/usr/bin/env node
import { cli } from 'hono-cli-adapter'
import { generateSpecs } from 'hono-openapi'
import app from './app.mjs'

const openapi = () => generateSpecs(app, {
  documentation: {
    info: {
      title: 'slaq',
      version: '0.1.0'
    }
  }
})

await cli(app, process, { openapi })
