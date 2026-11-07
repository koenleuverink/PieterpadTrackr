import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { seedStages } from './db/db'
import { startAutoSync } from './lib/sync'

async function boot() {
  try {
    await seedStages()
    // Vraag de browser de opslag niet zomaar op te ruimen (Safari kan anders na weken data wissen).
    void navigator.storage?.persist?.()
  } catch (e) {
    console.error(e)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  startAutoSync()
}

void boot()
