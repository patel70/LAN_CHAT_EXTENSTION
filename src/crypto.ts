import * as crypto from 'crypto';

const SALT = 'lan-code-chat-static-salt-v1';
const ALGO = 'aes-256-gcm';

export function deriveRoomKey(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase || 'general', SALT, 32);
}

export function roomHash(passphrase: string): string {
  return crypto.createHash('sha256').update(passphrase || 'general').digest('hex').slice(0, 16);
}

/** Encrypts a JSON-serializable value into a single base64 wire string: iv|tag|ciphertext */
export function encryptPayload(value: unknown, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Decrypts a wire string produced by encryptPayload. Throws if the key/room doesn't match. */
export function decryptPayload<T = unknown>(wire: string, key: Buffer): T {
  if (typeof wire !== 'string' || !wire) {
    throw new Error('Invalid wire format');
  }
  const buf = Buffer.from(wire, 'base64');
  if (buf.length < 28) {
    throw new Error('Payload too short');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
