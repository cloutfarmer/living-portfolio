import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Turns a folder of originals into the pinboard's photos: photo-1.jpg, photo-2.jpg, … in numeric name order.
// Each is upright, at most LONG_EDGE pixels, JPEG, and carries no EXIF, XMP or IPTC, so no location or camera data
// ships. The first print on the board (top left) gets photo-1. macOS only: it uses the built-in sips.
// The wall redraws them as 96-pixel art (PIXEL_ART in PhotoWall.tsx), so 256 is 2.6x what it needs.
const LONG_EDGE = 256
// Quality steps down until a photo fits under MOST_BYTES; one that never fits stops the run.
const QUALITIES = [80, 70, 60]
const MOST_BYTES = 100_000
const INPUTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.tif', '.tiff'])

const source = process.argv[2] && resolve(process.argv[2])
if (!source || !existsSync(source) || !statSync(source).isDirectory()) {
  console.error('Usage: npm run prepare-photos -- <folder of originals>')
  process.exit(1)
}
const originals = readdirSync(source)
  .filter((name) => INPUTS.has(extname(name).toLowerCase()) && !name.startsWith('.'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (!originals.length) {
  console.error(`prepare-photos: no images in ${source}`)
  process.exit(1)
}

// The EXIF orientation tag (1 when absent), read from the JPEG's APP1 segment.
function orientationOf(bytes) {
  for (let at = 2; at + 4 < bytes.length && bytes[at] === 0xff; ) {
    const marker = bytes[at + 1]
    const length = bytes.readUInt16BE(at + 2)
    if (marker === 0xda) break
    if (marker === 0xe1 && bytes.toString('latin1', at + 4, at + 10) === 'Exif\0\0') {
      const tiff = at + 10
      const little = bytes.toString('latin1', tiff, tiff + 2) === 'II'
      const u16 = (offset) => (little ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset))
      const u32 = (offset) => (little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset))
      const ifd = tiff + u32(tiff + 4)
      for (let entry = 0; entry < u16(ifd); entry++) {
        const field = ifd + 2 + entry * 12
        if (u16(field) === 0x0112) return u16(field + 8)
      }
    }
    at += 2 + length
  }
  return 1
}

// Drops every APP1 (EXIF, XMP) and APP3–APP15 (IPTC and the rest) segment. Keeps APP0 (JFIF) and APP2 (the colour
// profile), and everything from the image data on.
function stripMetadata(bytes) {
  const kept = [bytes.subarray(0, 2)]
  let at = 2
  while (at + 4 < bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]
    if (marker === 0xda) break
    const end = at + 2 + bytes.readUInt16BE(at + 2)
    const app = marker >= 0xe0 && marker <= 0xef
    if (!app || marker === 0xe0 || marker === 0xe2) kept.push(bytes.subarray(at, end))
    at = end
  }
  kept.push(bytes.subarray(at))
  return Buffer.concat(kept)
}

// Orientation → the sips steps that make the pixels upright.
const UPRIGHT = { 2: [['-f', 'horizontal']], 3: [['-r', '180']], 4: [['-f', 'vertical']], 5: [['-r', '90'], ['-f', 'horizontal']], 6: [['-r', '90']], 7: [['-r', '270'], ['-f', 'horizontal']], 8: [['-r', '270']] }

const photos = fileURLToPath(new URL('../src/pinboard/', import.meta.url))
const work = mkdtempSync(join(tmpdir(), 'prepare-photos-'))
const sips = (...args) => execFileSync('sips', args, { stdio: ['ignore', 'ignore', 'pipe'] })
const outputs = []
try {
  originals.forEach((name, index) => {
    const out = join(work, `photo-${index + 1}.jpg`)
    let bytes
    for (const quality of QUALITIES) {
      // Every sips write re-encodes, at its default quality unless told otherwise, so each one names it.
      const jpeg = ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality)]
      sips(...jpeg, '-Z', String(LONG_EDGE), join(source, name), '--out', out)
      for (const step of UPRIGHT[orientationOf(readFileSync(out))] ?? []) sips(...jpeg, ...step, out)
      bytes = stripMetadata(readFileSync(out))
      if (orientationOf(bytes) !== 1 || bytes.includes('Exif\0\0', 0, 'latin1')) throw new Error(`metadata survived in ${name}`)
      if (bytes.length <= MOST_BYTES) {
        outputs.push({ name, out, bytes: bytes.length, quality })
        break
      }
    }
    if (bytes.length > MOST_BYTES) throw new Error(`${name} is over ${MOST_BYTES / 1000} KB even at quality ${QUALITIES.at(-1)}`)
    writeFileSync(out, bytes)
  })
  // Only replace the wall once every photo has passed.
  for (const name of readdirSync(photos)) rmSync(join(photos, name))
  for (const { out } of outputs) writeFileSync(join(photos, out.slice(work.length + 1)), readFileSync(out))
} catch (error) {
  console.error(`prepare-photos: ${error.message}; web/src/pinboard is unchanged`)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
if (!process.exitCode) {
  outputs.forEach(({ name, bytes, quality }, index) => console.log(`photo-${index + 1}.jpg  ${(bytes / 1000).toFixed(0)} KB  q${quality}  ← ${name}`))
  const total = outputs.reduce((sum, { bytes }) => sum + bytes, 0)
  console.log(`prepare-photos: ${outputs.length} photos, ${(total / 1000).toFixed(0)} KB in all`)
  // PRINTS in PhotoWall.tsx sets the count.
  if (outputs.length !== 9) console.log('Note: the board has 9 prints. Fewer repeat; more make the wall swap photos and break the 1–9 order.')
}
