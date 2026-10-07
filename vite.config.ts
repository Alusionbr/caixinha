import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// "base" relativo permite publicar em qualquer subpasta (GitHub Pages, Vercel etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
})
