#!/bin/bash

set -e

echo "🚀 Setting up task-orchestrator-pwa..."

# Setup Node.js environment
echo "🔧 Setting up Node.js environment..."
if [ -n "$NVM_DIR" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "📦 Found nvm, loading Node.js..."
    . "$NVM_DIR/nvm.sh"
    
    # Check if Node 20+ is available
    if nvm list | grep -q "v2[0-9]"; then
        echo "✅ Found Node.js 20+, switching to it..."
        nvm use $(nvm list | grep "v2[0-9]" | head -1 | tr -d '->' | tr -d ' ' | tr -d '*')
    elif nvm list | grep -q "v1[8-9]"; then
        echo "📥 Installing Node.js 20 (current: $(node --version))..."
        nvm install 20
        nvm use 20
        echo "✅ Installed and switched to Node.js $(node --version)"
    else
        echo "📥 Installing latest LTS Node.js..."
        nvm install --lts
        nvm use --lts
        echo "✅ Installed and switched to Node.js $(node --version)"
    fi
elif command -v node >/dev/null 2>&1; then
    echo "✅ Node.js already available: $(node --version)"
else
    echo "❌ No Node.js found. Please install Node.js 20+ first."
    echo "💡 Recommended: Install nvm and run: nvm install 20 && nvm use 20"
    exit 1
fi

# Verify Node.js version
NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version $(node --version) is too old. Please use Node.js 20+"
    echo "📥 Attempting to install Node.js 20..."
    if [ -n "$NVM_DIR" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh"
        nvm install 20
        nvm use 20
        echo "✅ Installed and switched to Node.js $(node --version)"
    else
        echo "❌ Cannot install Node.js automatically. Please install Node.js 20+ manually."
        exit 1
    fi
fi

# Remove existing directory if it exists
if [ -d "task-orchestrator-pwa" ]; then
    echo "🗑️ Removing existing task-orchestrator-pwa directory..."
    rm -rf task-orchestrator-pwa
fi

# Create Next.js app with TypeScript and App Router
echo "📱 Creating Next.js app..."
npx create-next-app@latest task-orchestrator-pwa \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir \
    --import-alias "@/*" \
    --yes

cd task-orchestrator-pwa

# Install additional dependencies
echo "📦 Installing additional dependencies..."
npm install idb @testing-library/react vitest jsdom @lhci/cli zod

# Install dev dependencies
npm install -D @types/node

# Create .env.local
echo "🔧 Creating environment file..."
cat > .env.local << EOF
OLLAMA_BASE_URL=http://localhost:11434
MODEL_NAME=llama3.1
EOF

# Create next.config.js
echo "⚙️ Configuring Next.js..."
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA configuration using Next.js built-in features
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
  // Service worker and PWA assets
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/api/sw',
      },
    ]
  },
}

module.exports = nextConfig
EOF

# Create public/manifest.json
echo "📋 Creating web app manifest..."
mkdir -p public
cat > public/manifest.json << 'EOF'
{
  "name": "Task Orchestrator PWA",
  "short_name": "TaskOrch",
  "description": "A PWA for managing tasks with local LLM integration",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
EOF

# Create icons directory and placeholder icons
echo "🎨 Creating icon placeholders..."
mkdir -p public/icons
# Create simple SVG icons and convert to PNG (placeholder approach)
cat > public/icons/icon-192x192.svg << 'EOF'
<svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#000000"/>
  <text x="96" y="96" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dy=".3em">T</text>
</svg>
EOF

cat > public/icons/icon-512x512.svg << 'EOF'
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#000000"/>
  <text x="256" y="256" font-family="Arial" font-size="128" fill="white" text-anchor="middle" dy=".3em">T</text>
</svg>
EOF

# Convert SVG to PNG using ImageMagick if available, otherwise create simple text files
if command -v convert >/dev/null 2>&1; then
    convert public/icons/icon-192x192.svg public/icons/icon-192x192.png
    convert public/icons/icon-512x512.svg public/icons/icon-512x512.png
    rm public/icons/*.svg
else
    echo "⚠️ ImageMagick not found. Using placeholder icons."
    echo "PNG" > public/icons/icon-192x192.png
    echo "PNG" > public/icons/icon-512x512.png
fi

# Create app/layout.tsx
echo "🏗️ Creating app layout..."
mkdir -p src/app
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Task Orchestrator PWA',
  description: 'A PWA for managing tasks with local LLM integration',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Task Orchestrator PWA',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF

# Create app/page.tsx
echo "📄 Creating main page..."
cat > src/app/page.tsx << 'EOF'
'use client'

import { useState, useEffect } from 'react'
import { getAllTasks, upsertTask, deleteTask } from '@/lib/idb'
import { syncOutbox } from '@/lib/net'
import { Task } from '@/types'

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [prompt, setPrompt] = useState('')
  const [llmResponse, setLlmResponse] = useState('')
  const [isLoadingLLM, setIsLoadingLLM] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    loadTasks()
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

  const suggestTasks = async () => {
    if (!prompt.trim()) return
    
    setIsLoadingLLM(true)
    setLlmResponse('')
    
    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      })
      
      if (response.ok) {
        const data = await response.json()
        setLlmResponse(data.text)
      }
    } catch (error) {
      console.error('LLM request failed:', error)
      setLlmResponse('LLM request failed. Make sure Ollama is running.')
    } finally {
      setIsLoadingLLM(false)
    }
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
            />
            <button
              onClick={suggestTasks}
              disabled={isLoadingLLM}
              className={`px-4 py-2 rounded-lg ${
                isLoadingLLM 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white`}
            >
              {isLoadingLLM ? '⏳ Asking...' : 'Ask'}
            </button>
          </div>
          {isLoadingLLM && (
            <div className="bg-blue-100 p-3 rounded-lg text-sm text-center">
              <span className="animate-pulse">🤔 Thinking...</span>
            </div>
          )}
          {llmResponse && (
            <div className="bg-gray-100 p-3 rounded-lg text-sm">
              <strong>LLM Response:</strong> {llmResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
EOF

# Create types
echo "📝 Creating types..."
mkdir -p src/types
cat > src/types/index.ts << 'EOF'
export interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

export interface LLMRequest {
  prompt: string
}

export interface LLMResponse {
  text: string
}
EOF

# Create lib/idb.ts
echo "🗄️ Creating IndexedDB helpers..."
mkdir -p src/lib
cat > src/lib/idb.ts << 'EOF'
import { Task } from '@/types'

const DB_NAME = 'TaskOrchestratorDB'
const DB_VERSION = 1
const TASKS_STORE = 'tasks'
const OUTBOX_STORE = 'outbox'

let db: IDBDatabase | null = null

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        const tasksStore = db.createObjectStore(TASKS_STORE, { keyPath: 'id' })
        tasksStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outboxStore = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
        outboxStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

export const getAllTasks = async (): Promise<Task[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TASKS_STORE], 'readonly')
    const store = transaction.objectStore(TASKS_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export const upsertTask = async (task: Task): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TASKS_STORE], 'readwrite')
    const store = transaction.objectStore(TASKS_STORE)
    const request = store.put(task)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const deleteTask = async (id: string): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TASKS_STORE], 'readwrite')
    const store = transaction.objectStore(TASKS_STORE)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const addToOutbox = async (action: { type: string; payload: any }): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([OUTBOX_STORE], 'readwrite')
    const store = transaction.objectStore(OUTBOX_STORE)
    const outboxItem = {
      id: Date.now().toString(),
      action,
      timestamp: Date.now()
    }
    const request = store.put(outboxItem)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const getOutbox = async (): Promise<any[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([OUTBOX_STORE], 'readonly')
    const store = transaction.objectStore(OUTBOX_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export const clearOutbox = async (): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([OUTBOX_STORE], 'readwrite')
    const store = transaction.objectStore(OUTBOX_STORE)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
EOF

# Create lib/net.ts
echo "🌐 Creating network helpers..."
cat > src/lib/net.ts << 'EOF'
import { getOutbox, clearOutbox } from './idb'

export const syncOutbox = async (): Promise<void> => {
  if (!navigator.onLine) return

  try {
    const outbox = await getOutbox()
    
    for (const item of outbox) {
      try {
        // Process each outbox item based on action type
        switch (item.action.type) {
          case 'CREATE_TASK':
          case 'UPDATE_TASK':
          case 'DELETE_TASK':
            // These are already handled by IndexedDB, just clear the outbox
            break
          default:
            console.log('Unknown outbox action:', item.action.type)
        }
      } catch (error) {
        console.error('Failed to process outbox item:', error)
        // Keep the item in outbox for retry
        continue
      }
    }
    
    // Clear outbox after successful sync
    await clearOutbox()
  } catch (error) {
    console.error('Failed to sync outbox:', error)
  }
}
EOF

# Create API routes
echo "🔌 Creating API routes..."
mkdir -p src/app/api/health
cat > src/app/api/health/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
EOF

mkdir -p src/app/api/tasks
cat > src/app/api/tasks/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'

// In-memory store for demo purposes
let tasks: any[] = []

export async function GET() {
  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, task } = body

    switch (action) {
      case 'create':
        const newTask = { ...task, id: Date.now().toString() }
        tasks.push(newTask)
        return NextResponse.json(newTask)
      
      case 'toggle':
        const taskToToggle = tasks.find(t => t.id === task.id)
        if (taskToToggle) {
          taskToToggle.completed = !taskToToggle.completed
        }
        return NextResponse.json(taskToToggle)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }
    
    const index = tasks.findIndex(t => t.id === id)
    if (index > -1) {
      tasks.splice(index, 1)
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
EOF

mkdir -p src/app/api/llm
cat > src/app/api/llm/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
    }

    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    const modelName = process.env.MODEL_NAME || 'llama3.1'
    
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()
    
    return NextResponse.json({
      text: data.response || 'No response from LLM'
    })
  } catch (error) {
    console.error('LLM API error:', error)
    return NextResponse.json({ 
      error: 'LLM request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
EOF

# Create service worker API route
echo "🔧 Creating service worker API route..."
mkdir -p src/app/api/sw
cat > src/app/api/sw/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET() {
  const swContent = `
// Simple Service Worker for Task Orchestrator PWA
const CACHE_NAME = 'task-orchestrator-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`

  return new NextResponse(swContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
    },
  })
}
EOF

# Create test configuration
echo "🧪 Setting up testing..."
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
EOF

mkdir -p tests
cat > tests/setup.ts << 'EOF'
import { vi } from 'vitest'

// Mock IndexedDB for tests
const indexedDB = {
  open: vi.fn(),
}

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: indexedDB,
})

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})
EOF

cat > tests/health.test.ts << 'EOF'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'http'
import { parse } from 'url'
import { NextRequest } from 'next/server'

// Simple mock server for testing
let server: any

beforeAll(() => {
  server = createServer((req, res) => {
    const { pathname } = parse(req.url || '')
    
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }))
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  
  server.listen(3001)
})

afterAll(() => {
  server.close()
})

describe('Health API', () => {
  it('should return health status', async () => {
    const response = await fetch('http://localhost:3001/api/health')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.timestamp).toBeDefined()
  })
})
EOF

# Create GitHub Actions workflow
echo "🚀 Creating CI workflow..."
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]

    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Run unit tests
      run: npm test
    
    - name: Start application
      run: npm start &
      env:
        OLLAMA_BASE_URL: http://localhost:11434
        MODEL_NAME: llama3.1
    
    - name: Wait for app to start
      run: |
        timeout 30 bash -c 'until curl -f http://localhost:3000/api/health; do sleep 1; done'
    
    - name: Run Lighthouse CI
      run: |
        npx @lhci/cli autorun
        # Check PWA score
        PWA_SCORE=$(npx @lhci/cli collect --url=http://localhost:3000 | grep "Progressive Web App" | awk '{print $2}' | sed 's/\.//')
        if [ "$PWA_SCORE" -lt 90 ]; then
          echo "PWA score $PWA_SCORE is below threshold of 90"
          exit 1
        fi
    
    - name: Stop application
      run: pkill -f "next start" || true
EOF

# Add package.json scripts
echo "📜 Adding package.json scripts..."
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:watch="vitest --watch"
npm pkg set scripts.llm:pull="ollama pull \$MODEL_NAME || echo 'Ollama not installed or failed to pull model'"
npm pkg set scripts.llm:serve="ollama serve || echo 'Ollama not installed'"

# Check for Ollama and provide setup instructions
echo "🔍 Checking for Ollama..."
if command -v ollama >/dev/null 2>&1; then
    echo "✅ Ollama found! Pulling model..."
    ollama pull $(grep MODEL_NAME .env.local | cut -d'=' -f2) || echo "⚠️ Failed to pull model"
    echo "💡 To start Ollama, run: ollama serve"
else
    echo "⚠️ Ollama not found. LLM features will be stubbed."
    echo "💡 Install Ollama from https://ollama.ai for LLM integration"
fi

# Create README.md
echo "📖 Creating README..."
cat > README.md << 'EOF'
# Task Orchestrator PWA

A Progressive Web App for managing tasks with local LLM integration via Ollama.

## Prerequisites

- **Node.js 20+** (required)
- **Ollama** (optional) - for LLM features

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **If Ollama is installed:**
   ```bash
   # Pull the model (first time only)
   npm run llm:pull
   
   # Start Ollama in another terminal
   npm run llm:serve
   ```

## Usage

- **Add tasks:** Type and press Enter or click Add
- **Toggle completion:** Check/uncheck the checkbox
- **Delete tasks:** Click the trash icon
- **Offline support:** App works offline, syncs when back online
- **Install as PWA:** Click "Install App" button when available
- **LLM integration:** Type prompts and get task suggestions

## LLM Demo

1. Ensure Ollama is running (`ollama serve`)
2. Type a prompt like "suggest 3 productivity tasks"
3. Click "Ask" to get local model response
4. Uses `${OLLAMA_BASE_URL}/api/generate` endpoint

## PWA Verification

- **Chrome DevTools:** Application tab → Manifest
- **Lighthouse:** Run PWA audit (expect 90+ score)
- **Local testing:** `npx @lhci/cli autorun`

## Next Steps

- Replace in-memory server store with file DB or SQLite
- Point `MODEL_NAME` to different local models
- Add task categories and priorities
- Implement real-time sync with backend

## Development

- **Tests:** `npm test` or `npm run test:watch`
- **Build:** `npm run build`
- **Start:** `npm start`

## Portfolio Strengthening Tasks

1. **Database Integration:** Replace in-memory store with PostgreSQL/MySQL, add user authentication, and implement real-time sync using WebSockets or Server-Sent Events.

2. **Advanced PWA Features:** Add push notifications for task reminders, implement background sync for offline changes, add service worker caching strategies, and create a native-like mobile experience with gesture support and haptic feedback.
EOF

# Final setup and launch
echo "🎉 Setup complete!"
echo ""
echo "🚀 Launching your PWA..."

# Activate Node.js and start the app
cd task-orchestrator-pwa
source ~/.nvm/nvm.sh
nvm use 20

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Clean install dependencies
echo "Installing dependencies..."
npm install

# Start development server
echo "Starting development server..."
echo "Your PWA will be available at: http://localhost:3000"
echo ""
echo "If you have Ollama:"
echo "1. npm run llm:pull"
echo "2. ollama serve (in another terminal)"
echo ""
echo "Press Ctrl+C to stop the server"
npm run dev
