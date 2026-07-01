const STORAGE_KEYS = {
  docs: 'eru.secure_slice.docs.v1',
  audit: 'eru.secure_slice.audit.v1',
  state: 'eru.secure_slice.state.v1',
  batteryMode: 'eru.secure_slice.battery_mode.v1',
  wipeEvidence: 'eru.secure_slice.wipe_evidence.v1',
};

const LOCKOUT_AFTER_FAILURES = 3;
const WIPE_AFTER_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

function encoder() {
  return new TextEncoder();
}

function toBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

async function sha256Base64(text) {
  const hash = await window.crypto.subtle.digest('SHA-256', encoder().encode(text));
  return toBase64(new Uint8Array(hash));
}

function nowIso() {
  return new Date().toISOString();
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function deriveAesKey(passphrase, salt, iterations = 500000) {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt,
      iterations,
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );

  return { key, iterations };
}

async function deriveHmacKey(passphrase, salt, iterations = 500000) {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt,
      iterations,
    },
    baseKey,
    256,
  );

  return window.crypto.subtle.importKey(
    'raw',
    bits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function readState() {
  return loadJson(STORAGE_KEYS.state, {
    failedAttempts: 0,
    lockoutUntil: null,
    wipeTriggered: false,
    updatedAt: null,
  });
}

function writeState(state) {
  saveJson(STORAGE_KEYS.state, state);
}

function createAuditEntry(prevHash, event) {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: nowIso(),
    prevHash,
    event,
  };
}

async function appendAudit(event) {
  const chain = readAuditChain();
  const prevHash = chain.length ? chain[chain.length - 1].hash : null;
  const entry = createAuditEntry(prevHash, event);
  const hash = await sha256Base64(JSON.stringify({
    timestamp: entry.timestamp,
    prevHash: entry.prevHash,
    event: entry.event,
  }));

  const next = [...chain, { ...entry, hash }];
  saveJson(STORAGE_KEYS.audit, next.slice(-500));
  return next[next.length - 1];
}

export function getOperationalStatus() {
  const online = navigator.onLine;
  return {
    online,
    mode: online ? 'connected' : 'air-gapped',
  };
}

export function subscribeOperationalStatus(callback) {
  const push = () => callback(getOperationalStatus());
  window.addEventListener('online', push);
  window.addEventListener('offline', push);
  return () => {
    window.removeEventListener('online', push);
    window.removeEventListener('offline', push);
  };
}

export function getBatteryOptimizationEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEYS.batteryMode) === '1';
  } catch {
    return false;
  }
}

export function setBatteryOptimizationEnabled(enabled) {
  localStorage.setItem(STORAGE_KEYS.batteryMode, enabled ? '1' : '0');
}

export function listVaultDocuments() {
  return loadJson(STORAGE_KEYS.docs, []);
}

function writeVaultDocuments(docs) {
  saveJson(STORAGE_KEYS.docs, docs);
}

export function readAuditChain() {
  return loadJson(STORAGE_KEYS.audit, []);
}

export async function verifyAuditChain() {
  const chain = readAuditChain();
  let prevHash = null;

  // eslint-disable-next-line no-restricted-syntax
  for (const entry of chain) {
    const expected = await sha256Base64(JSON.stringify({
      timestamp: entry.timestamp,
      prevHash: entry.prevHash,
      event: entry.event,
    }));

    if (entry.prevHash !== prevHash || entry.hash !== expected) {
      return false;
    }

    prevHash = entry.hash;
  }

  return true;
}

export async function storeSecureDocument({ title, plaintext, passphrase, expiresInHours = 0 }) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const { key, iterations } = await deriveAesKey(passphrase, salt);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder().encode(plaintext),
  );

  const ciphertext = toBase64(new Uint8Array(cipherBuffer));
  const sigSalt = randomBytes(16);
  const signatureKey = await deriveHmacKey(passphrase, sigSalt, iterations);
  const signaturePayload = JSON.stringify({ title, ciphertext });
  const signatureBuffer = await window.crypto.subtle.sign('HMAC', signatureKey, encoder().encode(signaturePayload));

  const createdAt = nowIso();
  const expiresAt = expiresInHours > 0
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  const doc = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt,
    expiresAt,
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA512',
      iterations,
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext,
    },
    signature: {
      algorithm: 'HMAC-SHA256',
      salt: toBase64(sigSalt),
      value: toBase64(new Uint8Array(signatureBuffer)),
    },
  };

  const docs = listVaultDocuments();
  writeVaultDocuments([doc, ...docs].slice(0, 200));
  await appendAudit({ type: 'document.stored', docId: doc.id, title: doc.title });
  return doc;
}

export async function unlockSecureDocument({ docId, passphrase }) {
  const state = readState();
  if (state.wipeTriggered) {
    throw new Error('Vault is wiped. Recovery requires approved re-provisioning.');
  }

  if (state.lockoutUntil && Date.now() < new Date(state.lockoutUntil).getTime()) {
    throw new Error('Vault is in lockout window due to failed attempts.');
  }

  const docs = listVaultDocuments();
  const doc = docs.find((item) => item.id === docId);
  if (!doc) {
    throw new Error('Document not found.');
  }

  if (doc.expiresAt && Date.now() >= new Date(doc.expiresAt).getTime()) {
    const remainingDocs = docs.filter((item) => item.id !== doc.id);
    writeVaultDocuments(remainingDocs);
    await appendAudit({ type: 'document.auto_destroyed', docId: doc.id, title: doc.title });
    throw new Error('Document expired and was destroyed.');
  }

  try {
    const salt = fromBase64(doc.crypto.salt);
    const iv = fromBase64(doc.crypto.iv);
    const ciphertext = fromBase64(doc.crypto.ciphertext);
    const sigSalt = fromBase64(doc.signature.salt);

    const { key, iterations } = await deriveAesKey(passphrase, salt, doc.crypto.iterations);
    const plaintextBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    const plaintext = new TextDecoder().decode(plaintextBuffer);
    const signatureKey = await deriveHmacKey(passphrase, sigSalt, iterations);
    const payload = JSON.stringify({ title: doc.title, ciphertext: doc.crypto.ciphertext });

    const validSignature = await window.crypto.subtle.verify(
      'HMAC',
      signatureKey,
      fromBase64(doc.signature.value),
      encoder().encode(payload),
    );

    if (!validSignature) {
      throw new Error('Document signature verification failed.');
    }

    writeState({ failedAttempts: 0, lockoutUntil: null, wipeTriggered: false, updatedAt: nowIso() });
    await appendAudit({ type: 'document.unlocked', docId: doc.id, title: doc.title });
    return { doc, plaintext };
  } catch (error) {
    const failedAttempts = (state.failedAttempts || 0) + 1;
    const nextState = {
      failedAttempts,
      lockoutUntil: failedAttempts >= LOCKOUT_AFTER_FAILURES
        ? new Date(Date.now() + LOCKOUT_MS).toISOString()
        : null,
      wipeTriggered: failedAttempts >= WIPE_AFTER_FAILURES,
      updatedAt: nowIso(),
    };

    writeState(nextState);
    await appendAudit({ type: 'document.unlock_failed', docId: doc.id, failedAttempts });

    if (nextState.wipeTriggered) {
      await wipeSecureSliceData('failed_unlock_threshold');
      throw new Error('Wipe trigger activated after repeated failed attempts.');
    }

    throw error;
  }
}

export async function purgeExpiredDocuments() {
  const docs = listVaultDocuments();
  const now = Date.now();
  const expired = docs.filter((doc) => doc.expiresAt && now >= new Date(doc.expiresAt).getTime());
  if (expired.length === 0) return 0;

  writeVaultDocuments(docs.filter((doc) => !doc.expiresAt || now < new Date(doc.expiresAt).getTime()));

  // eslint-disable-next-line no-restricted-syntax
  for (const doc of expired) {
    // eslint-disable-next-line no-await-in-loop
    await appendAudit({ type: 'document.auto_destroyed', docId: doc.id, title: doc.title });
  }

  return expired.length;
}

export function getLockoutState() {
  const state = readState();
  const lockoutUntilEpoch = state.lockoutUntil ? new Date(state.lockoutUntil).getTime() : 0;
  const lockoutRemainingMs = lockoutUntilEpoch > Date.now() ? lockoutUntilEpoch - Date.now() : 0;
  return { ...state, lockoutRemainingMs };
}

export async function wipeSecureSliceData(reason = 'manual_wipe') {
  localStorage.removeItem(STORAGE_KEYS.docs);
  localStorage.removeItem(STORAGE_KEYS.audit);
  writeState({
    failedAttempts: WIPE_AFTER_FAILURES,
    lockoutUntil: null,
    wipeTriggered: true,
    updatedAt: nowIso(),
  });

  saveJson(STORAGE_KEYS.wipeEvidence, {
    timestamp: nowIso(),
    reason,
  });
}

export function readWipeEvidence() {
  return loadJson(STORAGE_KEYS.wipeEvidence, null);
}

export async function initializeSecureSlice() {
  await purgeExpiredDocuments();
  await appendAudit({ type: 'secure_slice.initialized', mode: getOperationalStatus().mode });
}
