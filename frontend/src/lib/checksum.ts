/**
 * Client-side SHA-256 checksums for milestone deliverables (#254), using the
 * Web Crypto API so files never leave the browser to be hashed.
 */

export type HashInput = ArrayBuffer | ArrayBufferView | Blob | string;

export function hasSubtleCrypto(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle?.digest === 'function';
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Lower-case hex SHA-256 of a buffer, typed array, blob/file or UTF-8 string. */
export async function sha256Hex(input: HashInput): Promise<string> {
  if (!hasSubtleCrypto()) {
    throw new Error('This browser does not support the Web Crypto API (crypto.subtle).');
  }
  let data: ArrayBuffer;
  if (typeof input === 'string') {
    const bytes = new TextEncoder().encode(input);
    data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } else if (Object.prototype.toString.call(input) === '[object ArrayBuffer]') {
    data = input as ArrayBuffer;
  } else if (ArrayBuffer.isView(input)) {
    data = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  } else {
    data = await readBlob(input as Blob);
  }
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', data));
}

export const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: string | undefined | null): value is string {
  return typeof value === 'string' && SHA256_HEX.test(value.trim().toLowerCase());
}

/** `sha256: 3a7f...9b2c` */
export function truncateHash(hash: string, head = 4, tail = 4): string {
  const h = hash.trim().toLowerCase();
  return `sha256: ${h.slice(0, head)}...${h.slice(-tail)}`;
}

export interface IntegrityResult {
  match: boolean;
  expected: string;
  actual: string;
}

/** Hashes `file` and compares it, case-insensitively, with the hash recorded at upload. */
export async function verifyFileIntegrity(file: Blob, expectedHash: string): Promise<IntegrityResult> {
  const actual = await sha256Hex(file);
  const expected = expectedHash.trim().toLowerCase();
  return { match: actual === expected, expected, actual };
}

// ── Recording hashes in milestone metadata ───────────────────────────────────

export interface AttachmentChecksum {
  name: string;
  sha256: string;
}

const ATTACHMENT_LINE = /^- Attachment: (.+?) \([^)]*\) — sha256:([0-9a-fA-F]{64})\s*$/;

/** Formats one attachment line for `deliverable_notes`, carrying its SHA-256. */
export function formatAttachmentLine(name: string, size: string, sha256: string | undefined): string {
  return isSha256Hex(sha256)
    ? `- Attachment: ${name} (${size}) — sha256:${sha256.toLowerCase()}`
    : `- Attachment: ${name} (${size})`;
}

/** Reads the per-file checksums back out of a milestone's `deliverable_notes`. */
export function parseAttachmentChecksums(notes: string | undefined | null): AttachmentChecksum[] {
  if (!notes) return [];
  const out: AttachmentChecksum[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const match = line.match(ATTACHMENT_LINE);
    if (match) out.push({ name: match[1], sha256: match[2].toLowerCase() });
  }
  return out;
}
