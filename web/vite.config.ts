import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const room = readFileSync(new URL('../assets/processed/corner-desk.glb', import.meta.url))
// The room keeps one file name, which browsers cache for a day, while the script that reads it is renamed on every
// build. A hash of the file in its address makes a new script always fetch the room it was built against.
const ROOM_URL = `/corner-desk.glb?v=${createHash('sha256').update(room).digest('hex').slice(0, 8)}`
const PRELOAD = 'href="/corner-desk.glb"'

export default defineConfig({
  plugins: [
    react(),
    {
      // index.html preloads the room. It has to ask for the same address as the loader, or the file downloads twice.
      name: 'room-url',
      transformIndexHtml(html) {
        if (!html.includes(PRELOAD)) throw new Error(`index.html no longer preloads the room with ${PRELOAD}`)
        return html.replace(PRELOAD, `href="${ROOM_URL}"`)
      },
    },
  ],
  // Serve exported models from their home outside the app instead of copying them in.
  publicDir: '../assets/processed',
  define: {
    // The deploy Brotli-encodes the room, so its Content-Length is the compressed size while the loader counts
    // decoded bytes. The loader bar measures against the file's real size instead.
    __ROOM_BYTES__: room.byteLength,
    __ROOM_URL__: JSON.stringify(ROOM_URL),
  },
  build: {
    rollupOptions: {
      output: {
        // The libraries change far less often than the room's own code, so they keep their own cached file.
        manualChunks: (id) => (id.includes('/node_modules/') ? 'vendor' : undefined),
      },
    },
  },
})
