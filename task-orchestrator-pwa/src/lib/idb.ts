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
