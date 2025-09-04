import { NextRequest, NextResponse } from 'next/server'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, messages, includeTasks, tasks } = await request.json() as {
      conversationId?: string
      messages?: Message[]
      includeTasks?: boolean
      tasks?: Array<{ id: string; text: string; completed: boolean; createdAt: string }>
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const convId = conversationId || crypto.randomUUID()

    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const modelName = process.env.MODEL_NAME || 'llama3.1'

    const system = [
      'You are an assistant that proposes concrete, 3-5 actionable tasks.',
      'Use user tasks if provided to avoid duplicates, reference exact task text when relevant.',
      'Prefer short imperative sentences.',
    ].join(' ')

    const taskContext = includeTasks && Array.isArray(tasks)
      ? `\n\nCurrent tasks:\n${tasks.slice(0,20).map(t => `- [${t.completed?'x':' '}] ${t.text}`).join('\n')}`
      : ''

    const history = messages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : m.role === 'user' ? 'User' : 'System'}: ${m.content}`)
      .join('\n\n')

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: `System: ${system}\n\n${history}${taskContext}`,
        stream: false
      })
    })

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
    const data = await response.json()
    const text = data.response || 'No response from LLM'

    return NextResponse.json({
      conversationId: convId,
      message: { role: 'assistant', content: text }
    })
  } catch (error) {
    console.error('LLM API error:', error)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 500 })
  }
}
