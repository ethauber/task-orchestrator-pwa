
'use client'

import { useState, useEffect, useRef } from 'react'
import { Task } from '@/types'

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

  useEffect(() => {
    loadTasks()
    setupInstallPrompt()
    setupOnlineStatus()
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
    setLlmResponse('')
    setIsLoadingLLM(true)

    const tasksPayload = tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed, createdAt: t.createdAt }))

    try {
      if (useStream) {
        setStreaming(true)
        const ac = new AbortController()
        streamRef.current = ac
        const res = await fetch('/api/llm/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: [{ role: 'user', content: prompt }],
            includeTasks: true, 
            tasks: tasksPayload 
          }),
          signal: ac.signal
        })
        if (!res.ok || !res.body) throw new Error('Stream failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          setLlmResponse(prev => prev + decoder.decode(value))
        }
      } else {
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: [{ role: 'user', content: prompt }],
            includeTasks: true, 
            tasks: tasksPayload 
          })
        })
        const data = await res.json()
        if (res.ok) setLlmResponse(data.message?.content || data.text || 'No response')
        else setLlmResponse(data.error ?? 'LLM error')
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
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask for task suggestions..."
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
              {isLoadingLLM ? 'Thinking…' : 'Ask'}
            </button>
            {streaming && (
              <button onClick={cancelStream} className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">
                Stop
              </button>
            )}
          </div>
          {llmResponse && (
            <div className="bg-gray-100 p-3 rounded-lg text-sm whitespace-pre-wrap" role="status">
              <strong>LLM Response:</strong>{' '}
              {llmResponse || <span className="animate-pulse">…</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
