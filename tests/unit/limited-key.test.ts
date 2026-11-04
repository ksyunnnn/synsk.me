import { describe, expect, it } from 'vitest';
import {
  generateLimitedKey,
  hashLimitedKey,
  isLimitedKeyShape,
  matchesLimitedKey,
} from '@/features/resume/domain/limited-key';

/** 限定公開用の鍵（specs/002-resume/spec.md の FR-011・FR-012、research.md の R5） */

describe('鍵を作る', () => {
  it('43 文字の base64url', () => {
    const key = generateLimitedKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isLimitedKeyShape(key)).toBe(true);
  });

  it('作るたびに違う', () => {
    expect(generateLimitedKey()).not.toBe(generateLimitedKey());
  });
});

describe('ハッシュ', () => {
  it('同じ鍵は同じハッシュになる', async () => {
    const key = generateLimitedKey();
    expect(await hashLimitedKey(key)).toBe(await hashLimitedKey(key));
  });

  it('SHA-256 の 16 進で、鍵の平文を含まない（FR-012）', async () => {
    const key = generateLimitedKey();
    const hash = await hashLimitedKey(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key);
  });
});

describe('鍵を比べる（FR-011）', () => {
  it('同じ鍵は一致する', async () => {
    const key = generateLimitedKey();
    expect(await matchesLimitedKey(key, await hashLimitedKey(key))).toBe(true);
  });

  it('1 文字違う鍵は一致しない', async () => {
    const key = generateLimitedKey();
    const last = key.at(-1) === 'A' ? 'B' : 'A';
    expect(await matchesLimitedKey(key.slice(0, -1) + last, await hashLimitedKey(key))).toBe(false);
  });

  it.each(['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}!`])(
    '形の違う値 %s は一致しない',
    async (value) => {
      expect(await matchesLimitedKey(value, await hashLimitedKey(value))).toBe(false);
    },
  );

  it('保存したハッシュの形が違えば一致しない', async () => {
    const key = generateLimitedKey();
    expect(await matchesLimitedKey(key, key)).toBe(false);
  });
});
