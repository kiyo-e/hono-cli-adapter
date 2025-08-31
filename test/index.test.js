import { test } from 'node:test'
import assert from 'node:assert/strict'
import minimist from 'minimist'
import { Hono } from 'hono'
import {
  commandFromArgv,
  adaptAndFetch,
  listRoutesWithExamplesFromOpenApi,
  runCliDefault
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

test('runCliDefault help lists global flags', async () => {
  const app = new Hono()
  app.post('/ping', (c) => c.text('pong'))
  const { lines } = await runCliDefault(app, ['--help'])
  assert.equal(lines.includes('Flags:'), true)
  assert(lines.some((l) => l.includes('--json')))
})
