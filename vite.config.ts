import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Política de segurança de conteúdo: só permite scripts do próprio app e
// conexões com o Supabase. Entra apenas no build (em desenvolvimento o Vite
// precisa de scripts inline para o recarregamento automático).
const politicaSeguranca = (): Plugin => ({
  name: 'politica-seguranca',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      },
      injectTo: 'head-prepend',
    },
    { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
  ],
})

// "base" relativo permite publicar em qualquer subpasta (GitHub Pages, Vercel etc.)
export default defineConfig({
  base: './',
  plugins: [react(), politicaSeguranca()],
})
