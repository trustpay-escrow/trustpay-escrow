import { describe, expect, it } from 'vitest';
import {
  formatAttachmentLine,
  isSha256Hex,
  parseAttachmentChecksums,
  sha256Hex,
  truncateHash,
  verifyFileIntegrity,
} from './checksum';

// NIST / well-known SHA-256 test vectors.
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const TWO_BLOCK = '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1';

describe('sha256Hex (#254)', () => {
  it('matches the known test vectors', async () => {
    expect(await sha256Hex('')).toBe(EMPTY);
    expect(await sha256Hex('abc')).toBe(ABC);
    expect(await sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(TWO_BLOCK);
  });

  it('hashes buffers, typed arrays and blobs identically to strings', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(bytes)).toBe(ABC);
    expect(await sha256Hex(bytes.buffer.slice(0) as ArrayBuffer)).toBe(ABC);
    expect(await sha256Hex(new Blob(['abc']))).toBe(ABC);
    expect(await sha256Hex(new File(['abc'], 'a.txt'))).toBe(ABC);
  });

  it('hashes only the viewed slice of a typed array', async () => {
    const big = new TextEncoder().encode('xxabcxx');
    expect(await sha256Hex(big.subarray(2, 5))).toBe(ABC);
  });
});

describe('verifyFileIntegrity', () => {
  it('matches an untouched file, ignoring hash case', async () => {
    const result = await verifyFileIntegrity(new File(['abc'], 'a.txt'), ABC.toUpperCase());
    expect(result).toMatchObject({ match: true, actual: ABC });
  });

  it('flags a modified file', async () => {
    const result = await verifyFileIntegrity(new File(['abd'], 'a.txt'), ABC);
    expect(result.match).toBe(false);
    expect(result.actual).not.toBe(ABC);
  });
});

describe('display and metadata helpers', () => {
  it('truncates like sha256: 3a7f...9b2c', () => {
    expect(truncateHash('3a7f' + '0'.repeat(56) + '9b2c')).toBe('sha256: 3a7f...9b2c');
  });

  it('validates hex digests', () => {
    expect(isSha256Hex(ABC)).toBe(true);
    expect(isSha256Hex('abc')).toBe(false);
    expect(isSha256Hex(undefined)).toBe(false);
  });

  it('round-trips a checksum through the milestone notes', () => {
    const notes = [
      'Done.',
      '',
      '### Links & Attachments',
      formatAttachmentLine('design.pdf', '1.2 MB', ABC),
      formatAttachmentLine('no-hash.zip', '3 KB', undefined),
      '- Pull Request: https://github.com/o/r/pull/1',
    ].join('\n');
    expect(parseAttachmentChecksums(notes)).toEqual([{ name: 'design.pdf', sha256: ABC }]);
    expect(parseAttachmentChecksums(undefined)).toEqual([]);
  });
});
