
'use client'

import { useState, useEffect, useRef } from 'react'
import { getAllTasks, upsertTask, deleteTask, getAllConversations, addConversation, getMessages, addMessage } from '@/lib/idb'
import { syncOutbox } from '@/lib/net'
import { Task, Conversation, Message } from '@/types'

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [prompt, setPrompt] = useState('')
  const [isLoadingLLM, setIsLoadingLLM] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const streamRef = useRef<AbortController | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    loadTasks()
    loadConversations()
    setupInstallPrompt()
    setupOnlineStatus()
  }, [])

  const setupInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    })
  }

  const setupOnlineStatus = () => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) {
        syncOutbox()
      }
    }
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    setIsOnline(navigator.onLine)
  }

  const loadTasks = async () => {
    const loadedTasks = await getAllTasks()
    setTasks(loadedTasks)
  }

  const loadConversations = async () => {
    const loadedConvos = await getAllConversations()
    setConversations(loadedConvos)
    if (loadedConvos.length > 0) {
      setActiveConversationId(loadedConvos[0].id)
      const msgs = await getMessages(loadedConvos[0].id)
      setMessages(msgs)
    }
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    
    const task: Task = {
      id: Date.now().toString(),
      text: newTask.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }
    
    await upsertTask(task)
    setNewTask('')
    loadTasks()
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task) {
      task.completed = !task.completed
      await upsertTask(task)
      loadTasks()
    }
  }

  const removeTask = async (id: string) => {
    await deleteTask(id)
    loadTasks()
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

  const selectConversation = async (id: string) => {
    setActiveConversationId(id)
    const msgs = await getMessages(id)
    setMessages(msgs)
  }

  const createConversation = async (): Promise<string> => {
    const convo: Conversation = {
      id: Date.now().toString(),
      title: `Conversation ${conversations.length + 1}`,
      createdAt: new Date().toISOString()
    }
    await addConversation(convo)
    setConversations(prev => [...prev, convo])
    setActiveConversationId(convo.id)
    setMessages([])
    return convo.id
  }

  const sendMessage = async (useStream = true) => {
    if (!prompt.trim()) return
    setIsLoadingLLM(true)

    let convoId = activeConversationId
    if (!convoId) {
      convoId = await createConversation()
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      conversationId: convoId,
      role: 'user',
      content: prompt.trim(),
      createdAt: new Date().toISOString()
    }
    await addMessage(userMessage)
    setMessages(prev => [...prev, userMessage])
    setPrompt('')

    const tasksPayload = tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed, createdAt: t.createdAt }))

    try {
      if (useStream) {
        setStreaming(true)
        const ac = new AbortController()
        streamRef.current = ac
        const res = await fetch('/api/llm/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userMessage.content, includeTasks: true, tasks: tasksPayload, conversationId: convoId }),
          signal: ac.signal
        })
        if (!res.ok || !res.body) throw new Error('Stream failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        const assistantMessage: Message = {
          id: Date.now().toString(),
          conversationId: convoId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
        let fullText = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          fullText += decoder.decode(value)
          setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: fullText } : m))
        }
        await addMessage({ ...assistantMessage, content: fullText })
      } else {
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userMessage.content, includeTasks: true, tasks: tasksPayload, conversationId: convoId })
        })
        const data = await res.json()
        const text = res.ok ? data.text : data.error ?? 'LLM error'
        const assistantMessage: Message = {
          id: Date.now().toString(),
          conversationId: convoId,
          role: 'assistant',
          content: text,
          createdAt: new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
        await addMessage(assistantMessage)
      }
    } catch (e) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        conversationId: convoId,
        role: 'assistant',
        content: 'LLM request failed. Make sure Ollama is running.',
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
      await addMessage(errorMessage)
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
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
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
        
        {/* Conversations & Chat */}
        <div className="border-t pt-4 flex">
          <div className="w-48 pr-4 border-r">
            <button
              onClick={createConversation}
              className="w-full mb-2 bg-blue-600 text-white py-1 px-2 rounded hover:bg-blue-700">
              + New
            </button>
            <div className="space-y-1">
              {conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full text-left px-2 py-1 rounded ${c.id === activeConversationId ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 pl-4">
            <div className="mb-2 h-48 overflow-y-auto border p-2 rounded">
              {messages.map(m => (
                <div key={m.id} className={`mb-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-2 py-1 rounded ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{m.content}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoadingLLM}
                aria-busy={isLoadingLLM}
              />
              <button
                onClick={() => sendMessage(true)}
                disabled={isLoadingLLM || !prompt.trim()}
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
  )
}
