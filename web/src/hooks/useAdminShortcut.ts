import { useEffect } from 'react'
import { decodeUrl } from '../lib/obfuscate'

// Admin URL is base VITE_ADMIN_URL — encoded at build time. To regenerate:
//   node -e "
//   const url = 'https://your-admin.vercel.app';
//   const BASE_KEY = 0x5a;
//   const bytes = [];
//   for (let i = 0; i < url.length; i++) { bytes.push(url.charCodeAt(i) ^ (BASE_KEY + (i % 7))); }
//   console.log('[' + bytes.join(', ') + ']');
//   "
const ADMIN_URL_BYTES = [50, 47, 40, 45, 45, 101, 79, 117, 34, 51, 40, 44, 114, 1, 62, 54, 53, 51, 112, 41, 5, 40, 56, 57, 49, 112, 62, 16, 42]
const ADMIN_URL_KEY = 0x5A

const adminUrl = decodeUrl(ADMIN_URL_BYTES, ADMIN_URL_KEY)

export function useAdminShortcut() {
  useEffect(() => {
    // Skip if decoding failed (empty string fallback)
    if (!adminUrl) return

    function onKeyDown(e: KeyboardEvent) {
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.altKey &&
        (e.key === 'z' || e.key === 'Z')
      ) {
        e.preventDefault()
        window.open(adminUrl, '_blank', 'noopener,noreferrer')
      }
      // Cmd on Mac — check meta instead of ctrl
      if (
        e.metaKey &&
        e.shiftKey &&
        e.altKey &&
        (e.key === 'z' || e.key === 'Z')
      ) {
        e.preventDefault()
        window.open(adminUrl, '_blank', 'noopener,noreferrer')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}