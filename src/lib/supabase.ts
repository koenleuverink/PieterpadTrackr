import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const LS_URL = 'pp-supabase-url'
const LS_KEY = 'pp-supabase-key'

export function supabaseConfig() {
  let url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  let key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  try {
    url = localStorage.getItem(LS_URL) || url
    key = localStorage.getItem(LS_KEY) || key
  } catch {
    /* localStorage niet beschikbaar */
  }
  return { url: url?.trim() || '', key: key?.trim() || '', fromEnv: !!import.meta.env.VITE_SUPABASE_URL }
}

export function saveSupabaseConfig(url: string, key: string) {
  localStorage.setItem(LS_URL, url.trim())
  localStorage.setItem(LS_KEY, key.trim())
  client = null
}

export function clearSupabaseConfig() {
  localStorage.removeItem(LS_URL)
  localStorage.removeItem(LS_KEY)
  client = null
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const { url, key } = supabaseConfig()
  if (!url || !key) return null
  try {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  } catch {
    return null
  }
  return client
}

export const RECORDS_TABLE = 'pp_records'
export const PHOTO_BUCKET = 'photos'
