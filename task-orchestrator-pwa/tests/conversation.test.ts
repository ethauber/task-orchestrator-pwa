import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createServer } from 'http'
import { parse } from 'url'

// Simple mock server for testing conversations
let server: any
let conversations: any[] = []
let messages: any[] = []

beforeEach(() => {
  conversations = []
  messages = []
})

beforeAll(() => {
  server = createServer((req, res) => {
    const { pathname, searchParams } = parse(req.url || '', true)
    
    if (pathname === '/api/conversations' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(conversations))
    } else if (pathname === '/api/conversations' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        const conversation = {
          id: Date.now().toString(),
          ...JSON.parse(body)
        }
        conversations.push(conversation)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(conversation))
      })
    } else if (pathname?.startsWith('/api/conversations/') && pathname.endsWith('/messages') && req.method === 'GET') {
      const conversationId = pathname.split('/')[3]
      const conversationMessages = messages.filter(m => m.conversationId === conversationId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(conversationMessages))
    } else if (pathname === '/api/conversations/messages' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        const message = {
          id: Date.now().toString(),
          ...JSON.parse(body)
        }
        messages.push(message)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(message))
      })
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  
  server.listen(3002)
})

afterAll(() => {
  server.close()
})

describe('Conversation API', () => {
  it('should create a new conversation', async () => {
    const response = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Conversation',
        createdAt: new Date().toISOString()
      })
    })
    
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.title).toBe('Test Conversation')
    expect(data.id).toBeDefined()
  })

  it('should get conversations list', async () => {
    // First create a conversation
    await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Conversation',
        createdAt: new Date().toISOString()
      })
    })
    
    // Then get the list
    const response = await fetch('http://localhost:3002/api/conversations')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('should add messages to a conversation', async () => {
    // First create a conversation
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Conversation',
        createdAt: new Date().toISOString()
      })
    })
    const conversation = await convResponse.json()
    
    // Then add a message
    const messageResponse = await fetch('http://localhost:3002/api/conversations/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello, how are you?',
        createdAt: new Date().toISOString()
      })
    })
    
    const message = await messageResponse.json()
    expect(messageResponse.status).toBe(200)
    expect(message.content).toBe('Hello, how are you?')
    expect(message.conversationId).toBe(conversation.id)
  })

  it('should get messages for a conversation', async () => {
    // First create a conversation and message
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Conversation',
        createdAt: new Date().toISOString()
      })
    })
    const conversation = await convResponse.json()
    
    await fetch('http://localhost:3002/api/conversations/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
        createdAt: new Date().toISOString()
      })
    })
    
    // Then get the messages
    const response = await fetch(`http://localhost:3002/api/conversations/${conversation.id}/messages`)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].content).toBe('Test message')
  })
})

