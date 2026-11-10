import react from '@vitejs/plugin-react'
import { statSync } from 'node:fs'
import { defineConfig } from 'vite'

const models = new URL('../assets/processed/', import.meta.url)

export default defineConfig({
  plugins: [react()],
  // Serve exported models from their home outside the app instead of copying them in.
  publicDir: '../assets/processed',
  // The deploy Brotli-encodes the room, so its Content-Length is the compressed size while the loader counts decoded
  // bytes. The loader bar measures against the file's real size instead.
  define: { __ROOM_BYTES__: statSync(new URL('corner-desk.glb', models)).size },
})
