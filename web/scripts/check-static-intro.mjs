import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// index.html repeats the intro's name and title and the placard's links in plain HTML, for the moment before the
// script runs and for visitors without JavaScript. Nothing else ties those copies to the components, so compare them.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../index.html')
const intro = read('../src/components/Intro.tsx')
const contacts = read('../src/components/ContactLinks.tsx')
const siteLink = read('../src/components/SiteLink.tsx')

const one = (text, pattern, what) => {
  const found = text.match(pattern)
  assert(found, `could not find ${what}`)
  return found[1]
}
// The app's addresses are written against Vite's base, which is the site's root.
const fromRoot = (address) => address.replace('${import.meta.env.BASE_URL}', '/')

assert.equal(
  one(page, /<span class="intro-name">([^<]+)<\/span>/, "index.html's name"),
  one(intro, /<span className="intro-name">([^<]+)<\/span>/, "Intro.tsx's name"),
  'the name in index.html and Intro.tsx differ',
)
assert.equal(
  one(page, /<span class="intro-work">([^<]+)<\/span>/, "index.html's title"),
  one(intro, /const TITLE = '([^']+)'/, "Intro.tsx's TITLE"),
  'the title in index.html and Intro.tsx differ',
)

const noscript = one(page, /<noscript>([\s\S]*?)<\/noscript>/, "index.html's <noscript>")
assert.equal(
  one(noscript, /class="panel site-link-button" href="([^"]+)"/, "index.html's link to the site"),
  fromRoot(one(siteLink, /export const SITE_URL = `([^`]+)`/, "SiteLink.tsx's SITE_URL")),
  'the link to the site in index.html and SiteLink.tsx differ',
)
const plain = [...noscript.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map(([, href, label]) => ({ label, href }))
const live = [...contacts.matchAll(/\{ label: '([^']+)', href: [`']([^`']+)[`'] \}/g)].map(([, label, href]) => ({ label, href: fromRoot(href) }))
assert(live.length > 0, 'could not find CONTACTS in ContactLinks.tsx')
assert.deepEqual(plain, live, 'the contact links in index.html and ContactLinks.tsx differ')

console.log(`PASS: index.html's name, title, site link and ${live.length} contact links match the components`)
