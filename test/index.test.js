import { test } from 'node:test'
import assert from 'node:assert/strict'
import minimist from 'minimist'
import { Hono } from 'hono'
import {
  commandFromArgv,
  adaptAndFetch,
  listRoutesWithExamplesFromOpenApi,
  listHelpLinesFromOpenApi,
  runCli
} from '../dist/index.js'

// commandFromArgv tests

test('commandFromArgv extracts first segment', () => {
  const argv1 = minimist(['foo'])
  assert.equal(commandFromArgv(argv1), 'foo')
  const argv2 = minimist(['foo', 'bar'])
  assert.equal(commandFromArgv(argv2), 'foo')
  const argv3 = minimist([])
  assert.equal(commandFromArgv(argv3), undefined)
})

// beforeFetch map test

test('beforeFetch map applies only matching hook', async () => {
  const app = new Hono()
  app.post('/upload', async (c) => c.text(c.req.header('x-test') || ''))
  let called = false
  let otherCalled = false
  const { res } = await adaptAndFetch(app, ['upload'], {
    beforeFetch: {
      upload: (req) => {
        called = true
        const headers = new Headers(req.headers)
        headers.set('x-test', 'ok')
        return new Request(req, { headers })
      },
      other: () => {
        otherCalled = true
      }
    }
  })
  assert.equal(await res.text(), 'ok')
  assert.equal(called, true)
  assert.equal(otherCalled, false)
})

test('listRoutesWithExamplesFromOpenApi extracts params', () => {
  const openapi = {
    paths: {
      '/user/{id}': {
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'user id', schema: { type: 'string' } }
        ],
        post: {
          parameters: [
            { name: 'email', in: 'query', required: true, description: 'user email', schema: { type: 'string' } }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    age: { type: 'integer', description: 'user age' }
                  },
                  required: ['age']
                }
              }
            }
          }
        }
      }
    }
  }

  const { routes, examples, params } = listRoutesWithExamplesFromOpenApi(openapi, 'cmd')

  assert.deepEqual(routes, ['/user/:id'])
  assert.deepEqual(examples, ['cmd user <id> --email <email> --age <age>'])

  const lines = [
    examples[0],
    ...params[0]
      .filter((p) => p.in !== 'path')
      .map(
        (p) => `--${p.name} (${p.schema?.type}${p.required ? ', required' : ''}) : ${p.description}`
      )
  ]

  assert.deepEqual(lines, [
    'cmd user <id> --email <email> --age <age>',
    '--email (string, required) : user email',
    '--age (integer, required) : user age'
  ])
})

test('listHelpLinesFromOpenApi includes details', () => {
  const openapi = {
    paths: {
      '/ping/{id}': {
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'ping id', schema: { type: 'string' } }
        ],
        post: {
          parameters: [
            { name: 'token', in: 'query', required: false, description: 'access token', schema: { type: 'string', default: 'abc' } }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer', description: 'repeat count', default: 1 }
                  },
                  required: []
                }
              }
            }
          }
        }
      }
    }
  }

  const lines = listHelpLinesFromOpenApi(openapi, 'cmd')
  assert(lines.includes('cmd ping <id> --token <token> --count <count>'))
  assert(lines.some((l) => l.includes('--token') && l.includes('optional') && l.includes('default')))
  assert(lines.some((l) => l.includes('--count') && l.includes('optional') && l.includes('integer')))
  assert(lines.some((l) => l.includes('<id>') && l.includes('required') && l.includes('path')))
})

test('runCli help lists global flags', async () => {
  const app = new Hono()
  app.post('/ping', (c) => c.text('pong'))
  const { lines } = await runCli(app, ['--help'])
  assert.equal(lines.includes('Flags:'), true)
  assert(lines.some((l) => l.includes('--json')))
})

test('runCli help uses openapi when provided', async () => {
  const app = new Hono()
  app.post('/ping', (c) => c.text('pong'))
  const openapi = {
    paths: {
      '/ping': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'auth token', default: 'x' }
                  },
                  required: ['token']
                }
              }
            }
          }
        }
      }
    }
  }
  const { lines } = await runCli(app, ['--help'], { openapi })
  assert(lines.some((l) => l.includes('--token') && l.includes('required')))
  assert(lines.some((l) => l.includes('Flags:')))
})
