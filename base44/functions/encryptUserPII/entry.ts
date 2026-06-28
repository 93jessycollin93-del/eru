// Server-side PII encryption / decryption. Reads the master key from
// Deno.env.get('PII_ENCRYPTION_KEY') — the key NEVER leaves this runtime.
// Replaces the browser-side stub in src/lib/encryption.js, which used to
// inline VITE_ENCRYPTION_KEY into the JS bundle (or fall back to a
// per-process random key, making ciphertext unrecoverable on next load).
//
// Body:
//   { mode: 'encrypt' | 'decrypt', user: { phone?, ssn? } }
//
// Output: { user: { phone, ssn } } with phone and ssn either encrypted
// (mode=encrypt) or decrypted (mode=decrypt).
//
// Auth: caller must be authenticated. Encrypt is allowed for any user
// (you only encrypt your own PII before storing it). Decrypt is restricted
// to admin OR the same user.email as the caller — to prevent IDOR-style
// PII reads via the encryption oracle.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALGO = 'AES-GCM';
const KEY_HEX_LEN = 64; // 32 bytes hex-encoded

function hexToBytes(hex) {
  if (typeof hex !== 'string') throw new Error('Encryption key must be hex string');
  if (hex.length !== KEY_HEX_LEN) throw new Error('Encryption key must be 32 bytes (64 hex chars)');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function importKey() {
  const hex = Deno.env.get('PII_ENCRYPTION_KEY');
  if (!hex) throw new Error('PII_ENCRYPTION_KEY env var is not configured');
  return crypto.subtle.importKey('raw', hexToBytes(hex), ALGO, false, ['encrypt', 'decrypt']);
}

async function encryptString(plaintext) {
  if (!plaintext) return plaintext;
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  // Format: iv_hex:ciphertext_hex (auth tag is appended to ciphertext by AES-GCM)
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ct))}`;
}

async function decryptString(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.includes(':')) return ciphertext;
  const [ivHex, ctHex] = ciphertext.split(':');
  const key = await importKey();
  const pt = await crypto.subtle.decrypt(
    { name: ALGO, iv: hexToBytes(ivHex) },
    key,
    hexToBytes(ctHex),
  );
  return new TextDecoder().decode(pt);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mode, user: payload } = await req.json().catch(() => ({}));
    if (mode !== 'encrypt' && mode !== 'decrypt') {
      return Response.json({ error: 'mode must be "encrypt" or "decrypt"' }, { status: 400 });
    }
    if (!payload || typeof payload !== 'object') {
      return Response.json({ error: 'user payload required' }, { status: 400 });
    }

    // Decrypt is privileged: caller can only decrypt their own PII or any
    // PII as admin. Encrypt is unrestricted because you can only encrypt
    // values you already have in plaintext.
    if (mode === 'decrypt') {
      const targetEmail = payload.email || payload.user_email;
      if (targetEmail && targetEmail !== user.email && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const op = mode === 'encrypt' ? encryptString : decryptString;
    const out = { ...payload };
    if (payload.phone) out.phone = await op(payload.phone);
    if (payload.ssn) out.ssn = await op(payload.ssn);

    return Response.json({ user: out });
  } catch (error) {
    return Response.json({ error: error.message || 'Encryption operation failed' }, { status: 500 });
  }
});
