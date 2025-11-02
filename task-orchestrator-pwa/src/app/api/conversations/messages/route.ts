import { NextRequest, NextResponse } from 'next/server'

interface Message {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: string
}

// In-memory store for demo purposes
const messages: Message[] = []

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
    }
    
    const conversationMessages = messages.filter(m => m.conversationId === conversationId)
    return NextResponse.json(conversationMessages)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, conversationId, role, content, createdAt } = body

    const newMessage: Message = {
      id: id || Date.now().toString(),
      conversationId,
      role,
      content,
      createdAt: createdAt || new Date().toISOString()
    }

    messages.push(newMessage)
    return NextResponse.json(newMessage)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
