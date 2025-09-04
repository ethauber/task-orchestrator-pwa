export interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

export interface LLMRequest {
  prompt: string
  includeTasks?: boolean
}

export interface LLMResponse {
  text: string
}

export interface Conversation {
  id: string
  title?: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: string
}
