const KEYSTORE_DB = 'desksort-keystore';
const KEYSTORE_STORE = 'keys';
const DEVICE_KEY_ID = 'device-aes-256-gcm';

function openKeystore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEYSTORE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEYSTORE_STORE)) {
        db.createObjectStore(KEYSTORE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredRawKey(): Promise<CryptoKey | null> {
  const db = await openKeystore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEYSTORE_STORE, 'readonly');
    const store = tx.objectStore(KEYSTORE_STORE);
    const req = store.get(DEVICE_KEY_ID);
    req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function storeRawKey(key: CryptoKey): Promise<void> {
  const db = await openKeystore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEYSTORE_STORE, 'readwrite');
    const store = tx.objectStore(KEYSTORE_STORE);
    const req = store.put(key, DEVICE_KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

let memoryVaultKey: CryptoKey | null = null;

export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  if (memoryVaultKey) return memoryVaultKey;
  const existing = await getStoredRawKey();
  if (existing) {
    memoryVaultKey = existing;
    return existing;
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  await storeRawKey(key);
  memoryVaultKey = key;
  return key;
}

export async function rotateDeviceKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  await storeRawKey(key);
  memoryVaultKey = key;
  return key;
}

export async function getKeyFingerprint(): Promise<string> {
  try {
    const key = await getOrCreateDeviceKey();
    const exported = await crypto.subtle.exportKey('raw', key);
    const digest = await crypto.subtle.digest('SHA-256', exported);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  } catch {
    return 'DEVICE-HARDWARE-KEY';
  }
}

export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoded = new TextEncoder().encode(`desksort-vault-v1:${passphrase}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeSha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptBytes(plainBytes: Uint8Array): Promise<{
  ivBase64: string;
  encryptedPayloadBase64: string;
  sha256: string;
}> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainCopy = new Uint8Array(plainBytes.byteLength);
  plainCopy.set(plainBytes);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainCopy.buffer
  );
  const sha256 = await computeSha256(plainBytes);
  return {
    ivBase64: uint8ToBase64(iv),
    encryptedPayloadBase64: uint8ToBase64(new Uint8Array(cipherBuffer)),
    sha256,
  };
}

export async function decryptBytes(
  encryptedPayloadBase64: string,
  ivBase64: string
): Promise<Uint8Array> {
  const key = await getOrCreateDeviceKey();
  const iv = base64ToUint8(ivBase64);
  const cipherBytes = base64ToUint8(encryptedPayloadBase64);
  const ivCopy = new Uint8Array(iv.byteLength);
  ivCopy.set(iv);
  const cipherCopy = new Uint8Array(cipherBytes.byteLength);
  cipherCopy.set(cipherBytes);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivCopy },
    key,
    cipherCopy.buffer
  );
  return new Uint8Array(plainBuffer);
}

export async function encryptText(text: string): Promise<{
  ivBase64: string;
  encryptedPayloadBase64: string;
  sha256: string;
}> {
  const bytes = new TextEncoder().encode(text);
  return encryptBytes(bytes);
}

export async function decryptText(
  encryptedPayloadBase64: string,
  ivBase64: string
): Promise<string> {
  const bytes = await decryptBytes(encryptedPayloadBase64, ivBase64);
  return new TextDecoder().decode(bytes);
}
