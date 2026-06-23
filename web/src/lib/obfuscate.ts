/**
 * Build-time XOR cipher for obfuscating sensitive URLs.
 * Uses a per-character offset so identical bytes produce different encoded values.
 */

const BASE_KEY = 0x5a

/**
 * Encodes a plaintext string into an array of decimal byte values.
 * Each byte is XORed with (BASE_KEY + position % 7) to prevent pattern matching.
 */
export function encodeUrl(plaintext: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i)
    const key = BASE_KEY + (i % 7)
    bytes.push(charCode ^ key)
  }
  return bytes
}

/**
 * Decodes an array of byte values back into a string using the same XOR key derivation.
 */
export function decodeUrl(bytes: number[], key: number = BASE_KEY): string {
  try {
    const chars: string[] = []
    for (let i = 0; i < bytes.length; i++) {
      const computedKey = key + (i % 7)
      chars.push(String.fromCharCode(bytes[i] ^ computedKey))
    }
    return chars.join('')
  } catch {
    return ''
  }
}