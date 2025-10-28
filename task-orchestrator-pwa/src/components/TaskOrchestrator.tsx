'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Task, Conversation, Message } from '@/types'
import { 
  getAllTasks, 
  upsertTask, 
  deleteTask,
  getConversations,
  createConversation as createConversationDB,
  getMessages,
  addMessage
} from '@/lib/idb'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function TaskOrchestrator() {
  const [mounted, setMounted] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [prompt, setPrompt] = useState('')
  const [llmResponse, setLlmResponse] = useState('')
  const [isLoadingLLM, setIsLoadingLLM] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const streamRef = useRef<AbortController | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  
  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadTasks = useCallback(async () => {
    try {
      const loadedTasks = await getAllTasks()
      setTasks(loadedTasks)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const loadedConversations = await getConversations()
      setConversations(loadedConversations)
      if (loadedConversations.length > 0 && !activeConversationId) {
        setActiveConversationId(loadedConversations[0].id)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }, [activeConversationId])

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const loadedMessages = await getMessages(conversationId)
      setMessages(loadedMessages)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      loadTasks()
      loadConversations()
      setupInstallPrompt()
      setupOnlineStatus()
    }
  }, [mounted, loadTasks, loadConversations])

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId)
    }
  }, [activeConversationId, loadMessages])

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

  const createNewConversation = async () => {
    try {
      console.log('Creating new conversation...')
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: 'New Conversation',
        createdAt: new Date().toISOString()
      }
      
      console.log('Conversation object created:', newConversation)
      await createConversationDB(newConversation)
      console.log('Conversation saved to IndexedDB')
      setConversations(prev => [newConversation, ...prev])
      setActiveConversationId(newConversation.id)
      setMessages([])
      setPrompt('')
      setLlmResponse('')
    } catch (error) {
      console.error('Failed to create conversation:', error)
      alert('Failed to create conversation: ' + error)
    }
  }

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      const conversation = conversations.find(c => c.id === conversationId)
      if (conversation) {
        conversation.title = title
        await createConversationDB(conversation) // This will update the existing conversation
        setConversations(prev => prev.map(c => c.id === conversationId ? conversation : c))
      }
    } catch (error) {
      console.error('Failed to update conversation title:', error)
    }
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    
    try {
      console.log('Adding task:', newTask)
      const task: Task = {
        id: Date.now().toString(),
        text: newTask.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      }
      
      console.log('Task object created:', task)
      await upsertTask(task)
      console.log('Task saved to IndexedDB')
      setNewTask('')
      await loadTasks()
    } catch (error) {
      console.error('Failed to add task:', error)
      alert('Failed to add task: ' + error)
    }
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task) {
      try {
        task.completed = !task.completed
        await upsertTask(task)
        loadTasks()
      } catch (error) {
        console.error('Failed to toggle task:', error)
      }
    }
  }

  const removeTask = async (id: string) => {
    try {
      await deleteTask(id)
      loadTasks()
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
    if (!prompt.trim() || !activeConversationId) return
    setLlmResponse('')
    setIsLoadingLLM(true)

    const tasksPayload = tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed, createdAt: t.createdAt }))
    
    // Add user message to conversation
    const userMessage: Message = {
      id: Date.now().toString(),
      conversationId: activeConversationId,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString()
    }
    
    try {
      // Save user message to IndexedDB
      await addMessage(userMessage)
      setMessages(prev => [...prev, userMessage])
      
      // Update conversation title with first user message if it's still "New Conversation"
      if (messages.length === 0) {
        const title = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt
        await updateConversationTitle(activeConversationId, title)
      }
      
      if (useStream) {
        setStreaming(true)
        const ac = new AbortController()
        streamRef.current = ac
        const res = await fetch('/api/llm/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            conversationId: activeConversationId,
            messages: [{ role: 'user', content: prompt }],
            includeTasks: true, 
            tasks: tasksPayload 
          }),
          signal: ac.signal
        })
        if (!res.ok || !res.body) throw new Error('Stream failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ''
        
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          fullResponse += chunk
          setLlmResponse(fullResponse)
        }
        
        // Save assistant message to IndexedDB
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          conversationId: activeConversationId,
          role: 'assistant',
          content: fullResponse,
          createdAt: new Date().toISOString()
        }
        
        await addMessage(assistantMessage)
        setMessages(prev => [...prev, assistantMessage])
      } else {
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            conversationId: activeConversationId,
            messages: [{ role: 'user', content: prompt }],
            includeTasks: true, 
            tasks: tasksPayload 
          })
        })
        const data = await res.json()
        if (res.ok) {
          const responseText = data.message?.content || data.text || 'No response'
          setLlmResponse(responseText)
          
          // Save assistant message to IndexedDB
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            conversationId: activeConversationId,
            role: 'assistant',
            content: responseText,
            createdAt: new Date().toISOString()
          }
          
          await addMessage(assistantMessage)
          setMessages(prev => [...prev, assistantMessage])
        } else {
          setLlmResponse(data.error ?? 'LLM error')
        }
      }
      
      setPrompt('')
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

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Conversations Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Conversations</h2>
          <button
            onClick={createNewConversation}
            className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700"
          >
            New
          </button>
        </div>
        
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setActiveConversationId(conversation.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                activeConversationId === conversation.id
                  ? 'bg-blue-100 text-blue-800'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="font-medium truncate">
                {conversation.title}
              </div>
              <div className="text-xs text-gray-700">
                {new Date(conversation.createdAt).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Task Orchestrator</h1>
          
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
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
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
          
          {/* Message History */}
          {activeConversationId && messages.length > 0 && (
            <div className="border-t pt-4 mb-4">
              <h3 className="font-semibold mb-3 text-gray-800">Conversation History</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-100 ml-8'
                        : 'bg-gray-100 mr-8'
                    }`}
                  >
                    <div className="text-xs text-gray-700 mb-1">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* LLM Integration */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2 text-gray-800">LLM Task Suggestions</h3>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask for task suggestions..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
                disabled={isLoadingLLM || !activeConversationId}
                aria-busy={isLoadingLLM}
              />
              <button
                onClick={() => suggestTasks(true)}
                disabled={isLoadingLLM || !activeConversationId}
                className={`px-4 py-2 rounded-lg text-white ${
                  isLoadingLLM || !activeConversationId
                    ? 'bg-purple-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
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
            {!activeConversationId && (
              <div className="text-gray-700 text-sm mb-2">
                Create a new conversation to start chatting with the LLM
              </div>
            )}
            {llmResponse && (
              <div className="bg-gray-100 p-3 rounded-lg text-sm whitespace-pre-wrap" role="status">
                <strong>LLM Response:</strong>{' '}
                {llmResponse || <span className="animate-pulse">…</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
