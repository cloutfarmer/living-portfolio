/** The decoded size of corner-desk.glb, set in vite.config.ts. */
declare const __ROOM_BYTES__: number
/** The room's address, with a hash of the file so a changed room is never read from an old cache. Set in vite.config.ts. */
declare const __ROOM_URL__: string

// vite.config.ts reads the room's file. The app has no Node types, so declare only the calls it makes.
declare module 'node:fs' {
  export function readFileSync(path: URL): Uint8Array
}
declare module 'node:crypto' {
  export function createHash(algorithm: 'sha256'): {
    update(data: Uint8Array): { digest(encoding: 'hex'): string }
  }
}
