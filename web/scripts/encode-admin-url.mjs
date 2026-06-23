#!/usr/bin/env node
/**
 * Encode a VITE_ADMIN_URL for use in the source code.
 * 
 * Usage:
 *   VITE_ADMIN_URL=https://your-admin.vercel.app node scripts/encode-admin-url.mjs
 *
 * Output can be pasted directly into src/hooks/useAdminShortcut.ts as ADMIN_URL_BYTES.
 */

// Simple XOR cipher matching src/lib/obfuscate.ts
const BASE_KEY = 0x5a

const url = process.env.VITE_ADMIN_URL

if (!url) {
  console.error('Error: VITE_ADMIN_URL environment variable is not set.')
  console.error('Usage: VITE_ADMIN_URL=https://your-admin.vercel.app node scripts/encode-admin-url.mjs')
  process.exit(1)
}

const bytes = []
for (let i = 0; i < url.length; i++) {
  const charCode = url.charCodeAt(i)
  const key = BASE_KEY + (i % 7)
  bytes.push(charCode ^ key)
}

console.log(`// Admin URL: ${url}`)
console.log(`const ADMIN_URL_BYTES = [${bytes.join(', ')}]`)
console.log(`const ADMIN_URL_KEY = 0x${BASE_KEY.toString(16).toUpperCase()}`)