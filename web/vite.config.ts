import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Serve exported models from their home outside the app instead of copying them in.
  publicDir: '../assets/processed',
})
