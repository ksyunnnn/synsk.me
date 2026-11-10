import { describe, expect, it } from 'vitest';
import {
  MEDIA_MAX_BYTES,
  MEDIA_TOTAL_MAX_BYTES,
  checkMediaQuota,
  checkMediaSize,
  detectMediaType,
  parseMediaStorageKey,
} from '@/shared/domain/media';

/**
 * 画像の形式と大きさの決まり（src/shared/domain/media.ts、U5 の決定）。R2 への読み書きと応答は
 * tests/workers/media-storage.test.ts が持つ
 */

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === 'string' ? Array.from(value, (c) => c.charCodeAt(0)) : [value],
    ),
  );

describe('形式', () => {
  it.each([
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/png', bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)],
    ['image/gif', bytes('GIF87a')],
    ['image/gif', bytes('GIF89a')],
    ['image/webp', bytes('RIFF', 0, 0, 0, 0, 'WEBP')],
  ])('%s を先頭のバイトで見分ける', (type, head) => {
    expect(detectMediaType(head)).toBe(type);
  });

  it.each([
    ['SVG', bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
    ['RIFF の WAVE', bytes('RIFF', 0, 0, 0, 0, 'WAVE')],
    ['HTML', bytes('<!doctype html>')],
    ['空', bytes()],
  ])('%s を拒む', (_name, head) => {
    expect(detectMediaType(head)).toBeNull();
  });
});

describe('大きさ', () => {
  it('10 MB ちょうどは通し、1 バイト超えると拒む', () => {
    expect(MEDIA_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(checkMediaSize(MEDIA_MAX_BYTES)).toBeNull();
    expect(checkMediaSize(MEDIA_MAX_BYTES + 1)).toBe('too-large');
  });

  it('空を拒む', () => {
    expect(checkMediaSize(0)).toBe('empty');
  });
});

describe('置き場の総量', () => {
  it('上限は R2 の無料枠 10 GB-month を下回る 8 GB', () => {
    expect(MEDIA_TOTAL_MAX_BYTES).toBe(8 * 10 ** 9);
  });

  it('置いた量と足す画像の合計が上限ちょうどなら通し、1 バイト超えると拒む', () => {
    expect(checkMediaQuota(MEDIA_TOTAL_MAX_BYTES - 100, 100)).toBeNull();
    expect(checkMediaQuota(MEDIA_TOTAL_MAX_BYTES - 100, 101)).toBe('storage-full');
  });
});

describe('置き場のキー', () => {
  it('UUID の形だけを通す', () => {
    expect(parseMediaStorageKey('0b6f3c1e-1111-4222-8333-444455556666')).toBe(
      '0b6f3c1e-1111-4222-8333-444455556666',
    );
    expect(parseMediaStorageKey('1')).toBeNull();
    expect(parseMediaStorageKey('../0b6f3c1e-1111-4222-8333-444455556666')).toBeNull();
    expect(parseMediaStorageKey('0B6F3C1E-1111-4222-8333-444455556666')).toBeNull();
  });
});
