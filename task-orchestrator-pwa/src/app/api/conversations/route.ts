import { NextRequest, NextResponse } from 'next/server'

interface Conversation {
  id: string
  title: string
  createdAt: string
}

// In-memory store for demo purposes
const conversations: Conversation[] = []

export async function GET() {
  return NextResponse.json(conversations)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, createdAt } = body

    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: title || 'New Conversation',
      createdAt: createdAt || new Date().toISOString()
    }

    conversations.push(newConversation)
    return NextResponse.json(newConversation)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
