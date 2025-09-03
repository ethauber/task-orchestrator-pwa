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
