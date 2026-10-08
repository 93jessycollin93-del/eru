import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src')

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [react()],
  resolve: {
    // `@/…` → `src/…` (mirrors jsconfig.json)
    alias: { '@': srcDir },
  },
  optimizeDeps: {
    // Some app files keep JSX in plain .js; let the dependency scanner parse them.
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
});
