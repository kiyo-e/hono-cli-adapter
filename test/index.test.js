import { test } from 'node:test'
import assert from 'node:assert/strict'
import minimist from 'minimist'
import { Hono } from 'hono'
import {
  commandFromArgv,
  adaptAndFetch,
  listRoutesWithExamplesFromOpenApi,
  listRoutesWithExamplesFromComments
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

test('listRoutesWithExamplesFromComments extracts params', () => {
  const file = new URL('./fixtures/commentUser.ts', import.meta.url).pathname
  const { routes, examples, params } = listRoutesWithExamplesFromComments([file], 'cmd')

  assert.deepEqual(routes, ['/user/:id'])
  assert.deepEqual(examples, ['cmd user <id> --email <email> --age <age>'])
  assert.deepEqual(params, [
    [
      { name: 'id', in: 'path', required: true, description: 'user id' },
      { name: 'email', in: 'query', required: true, description: 'user email' },
      { name: 'age', in: 'body', required: false, description: 'user age' }
    ]
  ])
})

test('listRoutesWithExamplesFromOpenApi merges comment routes', () => {
  const commentFile = new URL('./fixtures/commentExtra.ts', import.meta.url).pathname
  const openapi = {
    paths: {
      '/user/{id}': {
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'user id', schema: { type: 'string' } }
        ],
        post: {
          parameters: [
            { name: 'email', in: 'query', required: true, description: 'user email', schema: { type: 'string' } }
          ]
        }
      }
    }
  }

  const { routes, examples, params } = listRoutesWithExamplesFromOpenApi(openapi, 'cmd', [commentFile])

  assert.deepEqual(routes, ['/user/:id', '/extra/:slug'])
  assert.deepEqual(examples, ['cmd user <id> --email <email>', 'cmd extra <slug> --token <token>'])
  assert.deepEqual(params, [
    [
      { name: 'id', in: 'path', required: true, description: 'user id', schema: { type: 'string' } },
      { name: 'email', in: 'query', required: true, description: 'user email', schema: { type: 'string' } }
    ],
    [
      { name: 'slug', in: 'path', required: true, description: 'slug id' },
      { name: 'token', in: 'query', required: true, description: 'access token' }
    ]
  ])
})

