# Task Orchestrator PWA

A Progressive Web App for managing tasks with local LLM integration via Ollama.

## Features

### ✅ **Core Functionality (Working)**
- **Task Management**: Add, toggle, and delete tasks with persistent storage
- **Conversation Threading**: Create multiple conversation threads with the LLM
- **Persistent Storage**: All data persists in IndexedDB (survives page refreshes)
- **LLM Integration**: Chat with local Ollama models for task suggestions
- **Responsive UI**: Modern, mobile-friendly interface with conversation sidebar

### 🔄 **PWA Features (Partially Working)**
- Basic PWA manifest and icons
- Service Worker (disabled in dev to prevent resource conflicts)
- App installation prompt (when available)

## Quick Start

### Prerequisites
- Node.js 20+
- Optional: Ollama for local LLM features

### Setup
```bash
npm install
npm run dev
```

### LLM Setup (Optional)
If you have Ollama installed:
```bash
npm run llm:pull    # Pull the default model
npm run llm:serve   # Start Ollama server
```

## How It Works

### Data Persistence
- **Tasks**: Stored in IndexedDB, persist across browser sessions
- **Conversations**: Each conversation thread is saved separately
- **Messages**: Full chat history is preserved for each conversation
- **Offline Support**: Works offline for existing data, syncs when online

### Conversation Flow
1. Click "New" to create a conversation thread
2. Type your prompt in the LLM input
3. The conversation title automatically updates based on your first message
4. All messages are saved and persist across page refreshes
5. Switch between conversations using the sidebar

### Architecture
- **Frontend**: React with TypeScript, Tailwind CSS
- **Storage**: IndexedDB for client-side persistence
- **API**: Next.js API routes for LLM integration
- **LLM**: Direct integration with Ollama's local models

## Development

### Build
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

## Next Steps

### PWA Enhancement
- Re-enable Service Worker with proper caching strategies
- Add offline-first architecture
- Implement background sync

### Data Management
- Add conversation export/import
- Implement conversation search
- Add conversation deletion

### LLM Features
- Support for multiple models
- Conversation context management
- Streaming response handling

## Troubleshooting

### Data Not Persisting
- Ensure IndexedDB is enabled in your browser
- Check browser console for IndexedDB errors
- Clear browser data if needed

### LLM Not Working
- Verify Ollama is running (`ollama serve`)
- Check the model is pulled (`ollama list`)
- Ensure Ollama is accessible at `http://localhost:11434`

### Build Errors
- Ensure Node.js 20+ is installed
- Clear `node_modules` and reinstall if needed
- Check TypeScript compilation errors
