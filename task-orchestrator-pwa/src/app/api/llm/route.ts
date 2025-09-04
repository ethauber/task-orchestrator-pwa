import { NextRequest, NextResponse } from 'next/server'
import { Task } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { prompt, includeTasks, tasks, conversationId } = await request.json() as {
      prompt: string; includeTasks?: boolean; tasks?: Task[]; conversationId?: string
    }
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 })

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

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: `System: ${system}\n\nUser: ${prompt}${taskContext}`,
        stream: false
      })
    })

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
    const data = await response.json()
    return NextResponse.json({ text: data.response || 'No response from LLM' })
  } catch (error) {
    console.error('LLM API error:', error)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 500 })
  }
}
