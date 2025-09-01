#!/usr/bin/env node
import { cli } from 'hono-cli-adapter'
import app from './app.mjs'

await cli(app)
