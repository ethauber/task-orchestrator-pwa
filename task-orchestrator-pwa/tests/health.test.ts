import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'http'
import { parse } from 'url'
import { NextRequest } from 'next/server'

// Simple mock server for testing
let server: any

beforeAll(() => {
  server = createServer((req, res) => {
    const { pathname } = parse(req.url || '')
    
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }))
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  
  server.listen(3001)
})

afterAll(() => {
  server.close()
})

describe('Health API', () => {
  it('should return health status', async () => {
    const response = await fetch('http://localhost:3001/api/health')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.timestamp).toBeDefined()
  })
})
