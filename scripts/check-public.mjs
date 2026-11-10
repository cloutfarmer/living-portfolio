// Fails if tracked files or commit metadata would publish personal information.
// Run from the repository root: node scripts/check-public.mjs
// Exit 0: clean. Exit 1: findings. Exit 2: could not verify (for example, git failed).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const PATTERNS = [
  ['absolute macOS path', /\/Users\/[A-Za-z]/],
  ['absolute Linux home path', /\/home\/[a-z][a-z0-9_-]*\//],
  ['personal email address', /[A-Za-z0-9._%+-]+@(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|proton|protonmail|aol)\.(com|me|net)\b/i],
]
// Text files only: in binary data these would match by chance.
const TEXT_PATTERNS = [
  ['CloudFront distribution ID', /\bE[A-Z0-9]{12,13}\b/],
  // Z2FDTNDATAQYW2 is the hosted zone every CloudFront distribution shares, so it identifies nobody.
  ['Route 53 hosted zone ID', /\bZ(?!2FDTNDATAQYW2\b)[A-Z0-9]{12,}\b/],
]
// Commit authors and committers must be a GitHub noreply address (yours or a bot's), or GitHub's own web-flow.
const NOREPLY = /@users\.noreply\.github\.com$|^noreply@github\.com$/

// Blender writes zstd as many frames with a seek table at the end, and Node decodes only the first frame it's given.
function unzstd(data) {
  const end = data.length
  if (data.readUInt32LE(end - 4) !== 0x8f92eab1) return zstdDecompressSync(data)
  const frames = data.readUInt32LE(end - 9)
  const entry = data[end - 5] & 0x80 ? 12 : 8 // sizes, plus a checksum when flagged
  const table = end - 9 - frames * entry
  const parts = []
  for (let i = 0, at = 0; i < frames; i++) {
    const size = data.readUInt32LE(table + i * entry)
    parts.push(zstdDecompressSync(data.subarray(at, at + size)))
    at += size
  }
  return Buffer.concat(parts)
}

// The readable text inside binary files that can carry paths: Blender files (often zstd-compressed) and GLB JSON.
function binaryText(data) {
  if (data.readUInt32BE(0) === 0x28b52ffd) data = unzstd(data)
  if (data.toString('latin1', 0, 7) === 'BLENDER') return data.toString('latin1')
  if (data.toString('latin1', 0, 4) === 'glTF') return data.toString('utf8', 20, 20 + data.readUInt32LE(12))
  return null // images and other binaries
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    console.error(`COULD NOT VERIFY: git ${args.join(' ')} failed: ${error.message}`)
    process.exit(2)
  }
}

const findings = []
for (const path of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
  if (path === 'scripts/check-public.mjs') continue
  let data
  try {
    data = readFileSync(path)
  } catch {
    continue // deleted in the working tree but still tracked
  }
  if (data.includes(0)) {
    let text
    try {
      text = binaryText(data)
    } catch (error) {
      console.error(`COULD NOT VERIFY: ${path} could not be read: ${error.message}`)
      process.exit(2)
    }
    if (text === null) continue
    for (const [label, pattern] of PATTERNS) if (pattern.test(text)) findings.push(`${path}: ${label} inside the file`)
    continue
  }
  data.toString('utf8').split('\n').forEach((line, index) => {
    for (const [label, pattern] of [...PATTERNS, ...TEXT_PATTERNS]) {
      if (pattern.test(line)) findings.push(`${path}:${index + 1}: ${label}`)
    }
  })
}

const hasCommits = (() => {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()
if (hasCommits) {
  for (const row of new Set(git(['log', '--format=%h %ae%n%h %ce', 'HEAD']).split('\n').filter(Boolean))) {
    const [hash, email] = row.split(' ')
    if (!NOREPLY.test(email)) findings.push(`commit ${hash}: author or committer email is not a noreply address`)
  }
}

if (findings.length) {
  console.error('Public-safety check failed. Remove these before committing:')
  for (const finding of findings) console.error(`  ${finding}`)
  console.error('Commit with your GitHub noreply address: git config user.email "<id>+<user>@users.noreply.github.com"')
  process.exit(1)
}
console.log(`Public-safety check passed${hasCommits ? '' : ' (no commits yet; files only)'}.`)
