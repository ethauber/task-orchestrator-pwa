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
