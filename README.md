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
