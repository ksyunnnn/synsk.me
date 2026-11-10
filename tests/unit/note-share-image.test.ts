import { describe, expect, it } from 'vitest';
import {
  NOTE_SHARE_IMAGE_SIZE,
  SITE_NOTE_SHARE_IMAGE_PATH,
  noteShareImagePath,
} from '@/features/note/domain/share-image';

/**
 * note を共有したときの画像（specs/003-note/plan.md の U8、research.md の R12）。小さい正方形で、
 * X の summary（1:1）・Facebook の最小（200×200）・LinkedIn の小さい画像（幅 401 px 未満）を満たす
 */

const KEY = '00000000-0000-4000-8000-000000000000';

describe('共有したときの画像の大きさ', () => {
  it('200 px 以上、401 px 未満の正方形', () => {
    expect(NOTE_SHARE_IMAGE_SIZE).toBeGreaterThanOrEqual(200);
    expect(NOTE_SHARE_IMAGE_SIZE).toBeLessThan(401);
  });
});

describe('noteShareImagePath', () => {
  it('site はサイト共通の小さい正方形の画像を指す', () => {
    expect(noteShareImagePath('sample-note', { kind: 'site' })).toBe(SITE_NOTE_SHARE_IMAGE_PATH);
  });

  it('media は、その note の代表画像を正方形に縮める経路を指す', () => {
    expect(noteShareImagePath('sample-note', { kind: 'media', storageKey: KEY })).toBe(
      `/notes/sample-note/card/${KEY}`,
    );
  });

  it('サイト共通の画像の経路は、note の識別子に使えない文字を含み、note の URL と重ならない', () => {
    expect(SITE_NOTE_SHARE_IMAGE_PATH.startsWith('/notes/')).toBe(false);
    expect(SITE_NOTE_SHARE_IMAGE_PATH).toMatch(/[^a-z0-9/-]/);
  });
});
