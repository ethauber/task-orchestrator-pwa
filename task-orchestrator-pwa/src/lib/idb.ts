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

      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' })
        messagesStore.createIndex('conversationId', 'conversationId', { unique: false })
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

export const addToOutbox = async (action: OutboxAction): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([OUTBOX_STORE], 'readwrite')
    const store = transaction.objectStore(OUTBOX_STORE)
    const outboxItem: OutboxItem = {
      id: Date.now().toString(),
      action,
      timestamp: Date.now()
    }
    const request = store.put(outboxItem)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
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

export const getConversations = async (): Promise<Conversation[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CONVERSATIONS_STORE], 'readonly')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export const createConversation = async (conversation: Conversation): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CONVERSATIONS_STORE], 'readwrite')
    const store = transaction.objectStore(CONVERSATIONS_STORE)
    const request = store.put(conversation)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
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
