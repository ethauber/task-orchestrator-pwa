import { NextRequest, NextResponse } from 'next/server'

interface Message {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: string
}

// In-memory store for demo purposes (shared with the messages route)
const messages: Message[] = []

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
    }
    
    const conversationMessages = messages.filter(m => m.conversationId === conversationId)
    return NextResponse.json(conversationMessages)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
