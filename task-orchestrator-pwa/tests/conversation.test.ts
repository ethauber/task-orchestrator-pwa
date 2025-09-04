import { describe, it, expect, beforeEach, vi } from 'vitest'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  messages: Message[]
}

// In-memory store to simulate conversations
const conversations: Record<string, Conversation> = {}

// Deterministic LLM stub
const llm = {
  generate: vi.fn((input: string) => `stubbed:${input}`)
}

function createConversation(): Conversation {
  const conv: Conversation = { id: Math.random().toString(36).slice(2), messages: [] }
  conversations[conv.id] = conv
  return conv
}

async function postMessage(conversationId: string, content: string) {
  const conv = conversations[conversationId]
  const userMsg: Message = { id: Math.random().toString(36).slice(2), role: 'user', content }
  conv.messages.push(userMsg)
  const assistantMsg: Message = { id: Math.random().toString(36).slice(2), role: 'assistant', content: llm.generate(content) }
  conv.messages.push(assistantMsg)
  return { userMsg, assistantMsg }
}

function listMessages(conversationId: string) {
  return conversations[conversationId].messages
}

beforeEach(() => {
  llm.generate.mockClear()
  for (const key of Object.keys(conversations)) delete conversations[key]
})

describe('conversation flow', () => {
  it('retrieves messages in posted order', async () => {
    const conv = createConversation()
    await postMessage(conv.id, 'hello')
    await postMessage(conv.id, 'world')
    const retrieved = listMessages(conv.id)
    expect(retrieved.map(m => m.content)).toEqual([
      'hello', 'stubbed:hello', 'world', 'stubbed:world'
    ])
  })

  it('keeps threads isolated', async () => {
    const conv1 = createConversation()
    const conv2 = createConversation()
    await postMessage(conv1.id, 'first')
    await postMessage(conv2.id, 'second')
    const msgs1 = listMessages(conv1.id).map(m => m.content)
    const msgs2 = listMessages(conv2.id).map(m => m.content)
    expect(msgs1).toEqual(['first', 'stubbed:first'])
    expect(msgs2).toEqual(['second', 'stubbed:second'])
  })
})

