export interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

export interface LLMRequest {
  prompt: string
  includeTasks?: boolean
  conversationId?: string
}

export interface LLMResponse {
  text: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}
