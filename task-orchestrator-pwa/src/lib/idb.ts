import { Task, Conversation, Message } from '@/types'

interface OutboxAction {
  type: string
  payload: unknown
}

interface OutboxItem {
  id: string
  action: OutboxAction
  timestamp: number
}

const DB_NAME = 'TaskOrchestratorDB'
const DB_VERSION = 2
const TASKS_STORE = 'tasks'
const OUTBOX_STORE = 'outbox'
const CONVERSATIONS_STORE = 'conversations'
const MESSAGES_STORE = 'messages'

let db: IDBDatabase | null = null

// Utility function to check IndexedDB availability and status
export const checkIndexedDBStatus = async (): Promise<{
  available: boolean
  error?: string
  databases?: string[]
}> => {
  try {
    if (!window.indexedDB) {
      return { available: false, error: 'IndexedDB not supported' }
    }

    // Try to get list of databases if supported
    let databases: string[] = []
    if ('databases' in indexedDB) {
      try {
        const dbList = await indexedDB.databases()
        databases = dbList.map(db => db.name || 'unknown')
      } catch (e) {
        console.log('Could not list databases:', e)
      }
    }

    return { available: true, databases }
  } catch (error) {
    return { available: false, error: String(error) }
  }
}

// Utility function to clear corrupted database
export const clearDatabase = async (): Promise<void> => {
  if (db) {
    db.close()
    db = null
  }
  
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME)
    deleteRequest.onsuccess = () => {
      console.log('✅ Database cleared successfully')
      resolve()
    }
    deleteRequest.onerror = () => {
      console.error('❌ Failed to clear database:', deleteRequest.error)
      reject(deleteRequest.error)
    }
    deleteRequest.onblocked = () => {
      console.error('❌ Database deletion blocked - close other tabs')
      reject(new Error('Database deletion blocked'))
    }
  })
}

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    console.log('🔄 initDB: Starting database initialization...')
    
    // Check if IndexedDB is available (per MDN documentation)
    if (!('indexedDB' in window)) {
      console.error('❌ initDB: IndexedDB is not supported in this browser')
      reject(new Error('IndexedDB is not supported'))
      return
    }
    
    if (!window.indexedDB) {
      console.error('❌ initDB: IndexedDB is disabled or blocked')
      reject(new Error('IndexedDB is disabled'))
      return
    }
    
    if (db) {
      console.log('✅ initDB: Using existing database connection')
      resolve(db)
      return
    }

    console.log('🔄 initDB: Opening IndexedDB:', DB_NAME, 'version:', DB_VERSION)
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    // Add timeout to catch hanging database operations
    const timeout = setTimeout(() => {
      console.error('⏰ initDB: Database operation timed out after 5 seconds!')
      reject(new Error('Database initialization timed out'))
    }, 5000)

    request.onerror = (event) => {
      console.error('❌ initDB: Database open error:', request.error)
      console.error('❌ initDB: Error event:', event)
      clearTimeout(timeout)
      reject(request.error || new Error('Unknown database error'))
    }
    
    request.onblocked = (event) => {
      console.error('❌ initDB: Database blocked - close other tabs using this database')
      console.error('❌ initDB: Blocked event:', event)
      clearTimeout(timeout)
      // Don't reject immediately - give user chance to close other tabs
      setTimeout(() => {
        reject(new Error('Database blocked - please close other tabs using this application'))
      }, 2000)
    }

    request.onupgradeneeded = (event) => {
      console.log('🔄 initDB: Database upgrade needed, creating stores...')
      clearTimeout(timeout) // Clear timeout during upgrade
      const upgradeDb = (event.target as IDBOpenDBRequest).result
      
      // Create object stores if they don't exist
      if (!upgradeDb.objectStoreNames.contains(TASKS_STORE)) {
        console.log('🔄 initDB: Creating tasks store')
        const tasksStore = upgradeDb.createObjectStore(TASKS_STORE, { keyPath: 'id' })
        tasksStore.createIndex('createdAt', 'createdAt', { unique: false })
      } else {
        // Store exists, ensure indexes exist
        const tasksStore = upgradeDb.transaction.objectStore(TASKS_STORE)
        if (!tasksStore.indexNames.contains('createdAt')) {
          tasksStore.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
      
      if (!upgradeDb.objectStoreNames.contains(OUTBOX_STORE)) {
        console.log('🔄 initDB: Creating outbox store')
        const outboxStore = upgradeDb.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
        outboxStore.createIndex('timestamp', 'timestamp', { unique: false })
      } else {
        // Store exists, ensure indexes exist
        const outboxStore = upgradeDb.transaction.objectStore(OUTBOX_STORE)
        if (!outboxStore.indexNames.contains('timestamp')) {
          outboxStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }

      if (!upgradeDb.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        console.log('🔄 initDB: Creating conversations store')
        upgradeDb.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' })
      }

      if (!upgradeDb.objectStoreNames.contains(MESSAGES_STORE)) {
        console.log('🔄 initDB: Creating messages store')
        const messagesStore = upgradeDb.createObjectStore(MESSAGES_STORE, { keyPath: 'id' })
        messagesStore.createIndex('conversationId', 'conversationId', { unique: false })
      } else {
        // Store exists, ensure indexes exist
        const messagesStore = upgradeDb.transaction.objectStore(MESSAGES_STORE)
        if (!messagesStore.indexNames.contains('conversationId')) {
          messagesStore.createIndex('conversationId', 'conversationId', { unique: false })
        }
      }
      
      console.log('✅ initDB: All stores and indexes created successfully')
    }
    
    request.onsuccess = () => {
      console.log('✅ initDB: Database opened successfully')
      clearTimeout(timeout)
      db = request.result
      
      // Add connection error handlers
      db.onerror = (event) => {
        console.error('❌ Database connection error:', event)
      }
      
      db.onversionchange = () => {
        console.log('🔄 Database version change detected, closing connection')
        db?.close()
        db = null
      }
      
      resolve(db)
    }
  })
}

export const getAllTasks = async (): Promise<Task[]> => {
  console.log('🔄 getAllTasks: Starting...')
  try {
    const database = await initDB()
    console.log('✅ getAllTasks: Database ready')
    
    return new Promise((resolve, reject) => {
      console.log('🔄 getAllTasks: Creating transaction...')
      const transaction = database.transaction([TASKS_STORE], 'readonly')
      const store = transaction.objectStore(TASKS_STORE)
      const request = store.getAll()

      request.onerror = () => {
        console.error('❌ getAllTasks: Request error:', request.error)
        reject(request.error)
      }
      request.onsuccess = () => {
        console.log('✅ getAllTasks: Request success, result:', request.result)
        resolve(request.result || [])
      }
      
      transaction.onerror = () => {
        console.error('❌ getAllTasks: Transaction error:', transaction.error)
        reject(transaction.error)
      }
      
      console.log('🔄 getAllTasks: Transaction started, waiting for completion...')
    })
  } catch (error) {
    console.error('❌ getAllTasks: Caught error:', error)
    throw error
  }
}

export const upsertTask = async (task: Task): Promise<void> => {
  console.log('🔄 upsertTask: Starting with task:', task)
  try {
    const database = await initDB()
    console.log('✅ upsertTask: Database ready')
    
    return new Promise((resolve, reject) => {
      console.log('🔄 upsertTask: Creating transaction...')
      const transaction = database.transaction([TASKS_STORE], 'readwrite')
      const store = transaction.objectStore(TASKS_STORE)
      const request = store.put(task)

      // Add timeout to catch hanging operations
      const timeout = setTimeout(() => {
        console.error('⏰ upsertTask: Operation timed out after 5 seconds!')
        reject(new Error('IndexedDB operation timed out'))
      }, 5000)

      request.onerror = () => {
        console.error('❌ upsertTask: Request error:', request.error)
        clearTimeout(timeout)
        reject(request.error)
      }
      request.onsuccess = () => {
        console.log('✅ upsertTask: Request success')
        clearTimeout(timeout)
        resolve()
      }
      
      // Add transaction completion handlers
      transaction.oncomplete = () => {
        console.log('✅ upsertTask: Transaction complete')
        clearTimeout(timeout)
        resolve()
      }
      transaction.onerror = () => {
        console.error('❌ upsertTask: Transaction error:', transaction.error)
        clearTimeout(timeout)
        reject(transaction.error)
      }
      
      console.log('🔄 upsertTask: Transaction started, waiting for completion...')
    })
  } catch (error) {
    console.error('❌ upsertTask: Caught error:', error)
    throw error
  }
}

export const deleteTask = async (id: string): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TASKS_STORE], 'readwrite')
    const store = transaction.objectStore(TASKS_STORE)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const addToOutbox = async (action: OutboxAction): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([OUTBOX_STORE], 'readwrite')
    const store = transaction.objectStore(OUTBOX_STORE)
    const outboxItem: OutboxItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      timestamp: Date.now()
    }
    const request = store.put(outboxItem)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const getOutbox = async (): Promise<OutboxItem[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([OUTBOX_STORE], 'readonly')
    const store = transaction.objectStore(OUTBOX_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve(request.result || [])
    transaction.onerror = () => reject(transaction.error)
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
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const getConversations = async (): Promise<Conversation[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CONVERSATIONS_STORE], 'readonly')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve(request.result || [])
    transaction.onerror = () => reject(transaction.error)
  })
}

export const createConversation = async (conversation: Conversation): Promise<void> => {
  console.log('🔄 createConversation: Starting with conversation:', conversation)
  try {
    const database = await initDB()
    console.log('✅ createConversation: Database ready')
    
    return new Promise((resolve, reject) => {
      console.log('🔄 createConversation: Creating transaction...')
      const transaction = database.transaction([CONVERSATIONS_STORE], 'readwrite')
      const store = transaction.objectStore(CONVERSATIONS_STORE)
      const request = store.put(conversation)

      // Add timeout to catch hanging operations
      const timeout = setTimeout(() => {
        console.error('⏰ createConversation: Operation timed out after 5 seconds!')
        reject(new Error('IndexedDB operation timed out'))
      }, 5000)

      request.onerror = () => {
        console.error('❌ createConversation: Request error:', request.error)
        clearTimeout(timeout)
        reject(request.error)
      }
      request.onsuccess = () => {
        console.log('✅ createConversation: Request success')
        clearTimeout(timeout)
        resolve()
      }
      
      // Add transaction completion handlers
      transaction.oncomplete = () => {
        console.log('✅ createConversation: Transaction complete')
        clearTimeout(timeout)
        resolve()
      }
      transaction.onerror = () => {
        console.error('❌ createConversation: Transaction error:', transaction.error)
        clearTimeout(timeout)
        reject(transaction.error)
      }
      
      console.log('🔄 createConversation: Transaction started, waiting for completion...')
    })
  } catch (error) {
    console.error('❌ createConversation: Caught error:', error)
    throw error
  }
}

export const getMessages = async (conversationId: string): Promise<Message[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([MESSAGES_STORE], 'readonly')
    const store = transaction.objectStore(MESSAGES_STORE)
    const index = store.index('conversationId')
    const request = index.getAll(conversationId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve(request.result || [])
    transaction.onerror = () => reject(transaction.error)
  })
}

export const addMessage = async (message: Message): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([MESSAGES_STORE], 'readwrite')
    const store = transaction.objectStore(MESSAGES_STORE)
    const request = store.put(message)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
    
    // Add transaction completion handlers
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const deleteConversation = async (id: string): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite')
    const conversationsStore = transaction.objectStore(CONVERSATIONS_STORE)
    const messagesStore = transaction.objectStore(MESSAGES_STORE)

    conversationsStore.delete(id)

    const index = messagesStore.index('conversationId')
    const cursorRequest = index.openCursor(IDBKeyRange.only(id))

    cursorRequest.onerror = () => reject(cursorRequest.error)
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
