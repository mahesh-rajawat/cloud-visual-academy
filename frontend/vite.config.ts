/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const curriculum = fileURLToPath(new URL('../curriculum', import.meta.url))
const apiTarget = process.env.CVA_API ?? 'http://127.0.0.1:8000'

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; local builds stay at /.
  base: process.env.CVA_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@curriculum': curriculum } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': apiTarget },
  },
  preview: { port: 4173, strictPort: true, proxy: { '/api': apiTarget } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Tests cover every exam's content, including exams hidden in the default build.
    env: { VITE_EXAMS: 'all' },
  },
})
