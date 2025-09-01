#!/usr/bin/env node
import { cli } from '../../dist/index.js'
import app from './app.mjs'

await cli(app)
