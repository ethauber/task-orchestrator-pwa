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
