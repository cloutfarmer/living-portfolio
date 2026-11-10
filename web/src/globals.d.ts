/** The decoded size of corner-desk.glb, set in vite.config.ts. */
declare const __ROOM_BYTES__: number

// vite.config.ts reads that size. The app has no Node types, so declare only the call it makes.
declare module 'node:fs' {
  export function statSync(path: URL): { size: number }
}
