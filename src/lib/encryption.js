import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data (PII) before database storage
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data (format: iv:encrypted:authTag)
 */
export function encryptData(plaintext) {
  if (!plaintext) return plaintext;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:encrypted:authTag
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt sensitive data for display
 * @param {string} ciphertext - Encrypted data (format: iv:encrypted:authTag)
 * @returns {string} Decrypted plaintext
 */
export function decryptData(ciphertext) {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  
  try {
    const [ivHex, encryptedHex, authTagHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

/**
 * Encrypt PII fields in user object
 */
export function encryptUserPII(user) {
  return {
    ...user,
    phone: user.phone ? encryptData(user.phone) : null,
    ssn: user.ssn ? encryptData(user.ssn) : null,
  };
}

/**
 * Decrypt PII fields in user object
 */
export function decryptUserPII(user) {
  return {
    ...user,
    phone: user.phone ? decryptData(user.phone) : null,
    ssn: user.ssn ? decryptData(user.ssn) : null,
  };
}