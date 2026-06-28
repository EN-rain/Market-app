// Single source of truth for the backend API URL.
//
// Why this exists:
//   - Production builds MUST know the public backend URL at build time
//     (Vite inlines `import.meta.env.VITE_*` into the bundle). If
//     `VITE_API_URL` is missing in production, the site would silently
//     contact `http://localhost:3000` — the visitor's own machine — and
//     fail with ERR_CONNECTION_REFUSED / Mixed Content / CORS errors.
//   - We refuse to build (and refuse to boot in production) when the
//     variable is missing or unsafe, so the failure is loud at deploy
//     time instead of silent at runtime.

const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const isProd = import.meta.env.PROD

function resolveApiUrl(): string {
  if (rawApiUrl) {
    return rawApiUrl.replace(/\/+$/, '')
  }

  if (isProd) {
    // Fail loudly in production. We throw on first import so the build
    // surface the error (and so any runtime never ships a broken URL).
    throw new Error(
      '[PocketTrade] VITE_API_URL is required in production builds. ' +
        'Set it in Vercel → Settings → Environment Variables ' +
        '(e.g. https://pockettrade-ebaq.onrender.com) and redeploy.',
    )
  }

  // Dev fallback so `npm run dev` works out of the box.
  return 'http://localhost:3000'
}

export const API_URL: string = resolveApiUrl()

export function getAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export function getListingImageUrl(
  image?: { url?: string | null; imageUrl?: string | null } | null,
): string | undefined {
  return getAssetUrl(image?.imageUrl ?? image?.url)
}
