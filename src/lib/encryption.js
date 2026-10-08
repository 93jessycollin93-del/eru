/**
 * PII ENCRYPTION (client-side stub)
 *
 * The previous implementation read VITE_ENCRYPTION_KEY (which Vite inlines
 * into the JS bundle, exposing the key to every visitor) or fell back to a
 * per-process crypto.randomBytes(32) (which makes ciphertext unrecoverable
 * on the next page load). Either way, browser-side encryption was broken.
 *
 * The real implementation lives in:
 *   the encryptUserPII server function
 *
 * Use the SDK to invoke it from the client. Example:
 *   const { data } = await backend.functions.invoke('encryptUserPII', {
 *     mode: 'encrypt', user: { phone, ssn },
 *   });
 */

function notImplemented() {
  throw new Error(
    'Browser-side PII encryption removed for security. ' +
    'Invoke backend.functions.invoke("encryptUserPII", { mode, user }) instead — ' +
    'the master key must never ship to the bundle.',
  );
}

export const encryptData = notImplemented;
export const decryptData = notImplemented;
export const encryptUserPII = notImplemented;
export const decryptUserPII = notImplemented;