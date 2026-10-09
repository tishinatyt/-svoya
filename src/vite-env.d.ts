/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SVOYA_ENV: "local" | "test" | "production"
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_ENABLE_DEMO_EVENTS?: string
  readonly VITE_SVOYA_SIGNUP_MODE?: 'email' | 'username'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
