import { NextRequest } from 'next/server'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { conversationId, messages, includeTasks, tasks } = await req.json() as {
    conversationId?: string
    messages?: Message[]
    includeTasks?: boolean
    tasks?: Task[]
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response('Messages required', { status: 400 })
  }

  const convId = conversationId || crypto.randomUUID()

  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  const modelName = process.env.MODEL_NAME || 'llama3.1'

  const system = 'You suggest concrete, deduplicated next actions based on current tasks when provided.'
  const taskContext = includeTasks && Array.isArray(tasks)
    ? `\n\nCurrent tasks:\n${tasks.slice(0,20).map((t: Task) => `- [${t.completed?'x':' '}] ${t.text}`).join('\n')}`
    : ''

  const history = messages
    .map(m => `${m.role === 'assistant' ? 'Assistant' : m.role === 'user' ? 'User' : 'System'}: ${m.content}`)
    .join('\n\n')

  const upstream = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      prompt: `System: ${system}\n\n${history}${taskContext}`,
      stream: true
    })
  })

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream error', { status: 502 })
  }

  const ts = new TransformStream()
  const writer = ts.writable.getWriter()
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  ;(async () => {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue
          try {
            const j = JSON.parse(line)
            if (j.response) await writer.write(encoder.encode(j.response))
          } catch {}
        }
      }
    } finally {
      await writer.close()
    }
  })()

  return new Response(ts.readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Conversation-Id': convId
    }
  })
}


