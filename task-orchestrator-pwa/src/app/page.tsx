
'use client'

import { useState, useEffect, useRef } from 'react'
import { Task, Conversation, Message } from '@/types'
import { getConversations, createConversation, getMessages, addMessage } from '@/lib/idb'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

  export default function Home() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [newTask, setNewTask] = useState('')
    const [prompt, setPrompt] = useState('')
    const [llmResponse, setLlmResponse] = useState('')
    const [isLoadingLLM, setIsLoadingLLM] = useState(false)
    const [streaming, setStreaming] = useState(false)
    const streamRef = useRef<AbortController | null>(null)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isOnline, setIsOnline] = useState(true)
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])

    useEffect(() => {
      loadTasks()
      setupInstallPrompt()
      setupOnlineStatus()
      loadConversations()
    }, [])

  const setupInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    })
  }

  const setupOnlineStatus = () => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    setIsOnline(navigator.onLine)
  }

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const loadedTasks = await response.json()
        setTasks(loadedTasks)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    
    const task = {
      text: newTask.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', task })
      })
      
      if (response.ok) {
        setNewTask('')
        loadTasks()
      }
    } catch (error) {
      console.error('Failed to add task:', error)
    }
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task) {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle', task })
        })
        
        if (response.ok) {
          loadTasks()
        }
      } catch (error) {
        console.error('Failed to toggle task:', error)
      }
    }
  }

  const removeTask = async (id: string) => {
    try {
      const response = await fetch(`/api/tasks?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadTasks()
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const loadConversations = async () => {
    const loaded = await getConversations()
    setConversations(loaded)
    if (loaded.length > 0) {
      const first = loaded[0]
      setActiveConversationId(first.id)
      const msgs = await getMessages(first.id)
      setMessages(msgs)
    } else {
      await newConversation()
    }
  }

  const selectConversation = async (id: string) => {
    setActiveConversationId(id)
    const msgs = await getMessages(id)
    setMessages(msgs)
  }

  const newConversation = async () => {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    await createConversation(conv)
    setConversations(prev => [conv, ...prev])
    setActiveConversationId(conv.id)
    setMessages([])
  }

  const installApp = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }
    setDeferredPrompt(null)
  }

  const suggestTasks = async (useStream = true) => {
    if (!prompt.trim()) return

    let convId = activeConversationId
    if (!convId) {
      convId = crypto.randomUUID()
      const conv: Conversation = { id: convId, createdAt: new Date().toISOString() }
      await createConversation(conv)
      setConversations(prev => [conv, ...prev])
      setActiveConversationId(convId)
      setMessages([])
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString()
    }
    await addMessage(userMsg)
    setMessages(prev => [...prev, userMsg])
    setPrompt('')
    setLlmResponse('')
    setIsLoadingLLM(true)

    const tasksPayload = tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed, createdAt: t.createdAt }))
    const history = [...messages, userMsg].map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      if (useStream) {
        setStreaming(true)
        const ac = new AbortController()
        streamRef.current = ac
        const res = await fetch('/api/llm/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            messages: history,
            includeTasks: true,
            tasks: tasksPayload
          }),
          signal: ac.signal
        })
        if (!res.ok || !res.body) throw new Error('Stream failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let text = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          text += chunk
          setLlmResponse(prev => prev + chunk)
        }
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          conversationId: convId,
          role: 'assistant',
          content: text,
          createdAt: new Date().toISOString()
        }
        await addMessage(assistantMsg)
        setMessages(prev => [...prev, assistantMsg])
        setLlmResponse('')
      } else {
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            messages: history,
            includeTasks: true,
            tasks: tasksPayload
          })
        })
        const data = await res.json()
        if (res.ok) {
          const text = data.message?.content || data.text || 'No response'
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            conversationId: convId,
            role: 'assistant',
            content: text,
            createdAt: new Date().toISOString()
          }
          await addMessage(assistantMsg)
          setMessages(prev => [...prev, assistantMsg])
        } else {
          setLlmResponse(data.error ?? 'LLM error')
        }
      }
    } catch {
      setLlmResponse('LLM request failed. Make sure Ollama is running.')
    } finally {
      setIsLoadingLLM(false)
      setStreaming(false)
      streamRef.current = null
    }
  }

  const cancelStream = () => {
    streamRef.current?.abort()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Task Orchestrator</h1>
        
        {/* Install App Button */}
        {deferredPrompt && (
          <button
            onClick={installApp}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg mb-4 hover:bg-blue-700"
          >
            📱 Install App
          </button>
        )}
        
        {/* Online Status */}
        <div className={`text-center mb-4 p-2 rounded ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isOnline ? '🟢 Online' : '🔴 Offline'}
        </div>
        
        {/* Add Task */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && addTask()}
          />
          <button
            onClick={addTask}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
        
        {/* Tasks List */}
        <div className="space-y-2 mb-6">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                className="w-4 h-4 text-blue-600"
              />
              <span className={`flex-1 ${task.completed ? 'line-through text-gray-500' : ''}`}>
                {task.text}
              </span>
              <button
                onClick={() => removeTask(task.id)}
                className="text-red-600 hover:text-red-800"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
        
        {/* LLM Integration */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">LLM Task Suggestions</h3>
          <div className="flex gap-4">
            <div className="w-1/3">
              <button
                onClick={newConversation}
                className="w-full mb-2 bg-blue-600 text-white py-1 rounded-lg hover:bg-blue-700"
              >
                + New
              </button>
              <div className="space-y-1">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`w-full text-left p-2 rounded-lg ${c.id === activeConversationId ? 'bg-gray-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    {c.title || new Date(c.createdAt).toLocaleDateString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto mb-2 space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-blue-50 text-blue-800' : 'bg-gray-100'}`}
                  >
                    <strong>{m.role === 'assistant' ? 'Assistant' : 'User'}:</strong> {m.content}
                  </div>
                ))}
                {streaming && llmResponse && (
                  <div className="p-2 rounded-lg text-sm whitespace-pre-wrap bg-blue-50 text-blue-800">
                    <strong>Assistant:</strong> {llmResponse}
                  </div>
                )}
                {!streaming && llmResponse && (
                  <div className="p-2 rounded-lg text-sm text-red-600 whitespace-pre-wrap">
                    {llmResponse}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && suggestTasks(true)}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoadingLLM}
                  aria-busy={isLoadingLLM}
                />
                <button
                  onClick={() => suggestTasks(true)}
                  disabled={isLoadingLLM}
                  className={`px-4 py-2 rounded-lg text-white ${isLoadingLLM ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                  aria-busy={isLoadingLLM}
                >
                  {isLoadingLLM ? 'Thinking…' : 'Send'}
                </button>
                {streaming && (
                  <button onClick={cancelStream} className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
