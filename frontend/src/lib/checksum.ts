/**
 * Utility functions for computing and verifying SHA-256 cryptographic checksums
 * of deliverable files and buffers in-browser using Web Crypto API.
 */

/**
 * Computes the lowercase hex-encoded SHA-256 hash of an ArrayBuffer.
 */
export async function calculateBufferChecksum(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes the lowercase hex-encoded SHA-256 hash of a File or Blob.
 */
export async function calculateFileChecksum(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return calculateBufferChecksum(arrayBuffer);
}

/**
 * Computes the lowercase hex-encoded SHA-256 hash of a string (UTF-8 encoded).
 */
export async function calculateStringChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateBufferChecksum(data.buffer as ArrayBuffer);
}

/**
 * Compares a file's calculated SHA-256 checksum against an expected hash.
 * Case-insensitive comparison.
 */
export async function verifyFileChecksum(file: Blob, expectedHash: string): Promise<boolean> {
  if (!expectedHash || !expectedHash.trim()) {
    return false;
  }
  const calculated = await calculateFileChecksum(file);
  return calculated.toLowerCase() === expectedHash.trim().toLowerCase();
}

/**
 * Formats a SHA-256 hex string into a readable truncated representation.
 * Example: sha256: 3a7f...9b2c
 */
export function truncateHash(hash: string, leadChars = 4, trailChars = 4): string {
  if (!hash) return '';
  const clean = hash.replace(/^sha256:/i, '').trim();
  if (clean.length <= leadChars + trailChars) {
    return `sha256: ${clean}`;
  }
  return `sha256: ${clean.slice(0, leadChars)}...${clean.slice(-trailChars)}`;
}

export type HashInput = ArrayBuffer | ArrayBufferView | Blob | string;

export function hasSubtleCrypto(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle?.digest === 'function';
}

export async function sha256Hex(input: HashInput): Promise<string> {
  if (!hasSubtleCrypto()) {
    throw new Error('This browser does not support the Web Crypto API (crypto.subtle).');
  }
  if (typeof input === 'string') {
    return calculateStringChecksum(input);
  }
  if (Object.prototype.toString.call(input) === '[object ArrayBuffer]') {
    return calculateBufferChecksum(input as ArrayBuffer);
  }
  if (ArrayBuffer.isView(input)) {
    const buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
    return calculateBufferChecksum(buffer);
  }
  return calculateFileChecksum(input as Blob);
}

export const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: string | undefined | null): value is string {
  return typeof value === 'string' && SHA256_HEX.test(value.trim().toLowerCase());
}

export interface AttachmentChecksum {
  name: string;
  sha256: string;
}

const ATTACHMENT_LINE = /^- Attachment: (.+?) \([^)]*\) — sha256:([0-9a-fA-F]{64})\s*$/;

/** Formats one attachment line for deliverable notes, carrying its SHA-256 when valid. */
export function formatAttachmentLine(name: string, size: string, sha256: string | undefined): string {
  return isSha256Hex(sha256)
    ? `- Attachment: ${name} (${size}) — sha256:${sha256.toLowerCase()}`
    : `- Attachment: ${name} (${size})`;
}

/** Extracts per-file attachment SHA-256 checksums recorded in deliverable notes. */
export function parseAttachmentChecksums(notes: string | undefined | null): AttachmentChecksum[] {
  if (!notes) return [];
  const out: AttachmentChecksum[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const match = line.match(ATTACHMENT_LINE);
    if (match) {
      out.push({ name: match[1], sha256: match[2].toLowerCase() });
    }
  }
  return out;
}
