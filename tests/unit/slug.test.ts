import { describe, expect, it } from 'vitest';
import { isSlug, newSlug } from '@/shared/domain/slug';

/**
 * 訪問者向けの URL の識別子の形と既定値（src/shared/domain/slug.ts）。実績（specs/001-career-and-project/spec.md
 * の FR-013）と職務経歴書（specs/002-resume/spec.md の FR-002）が同じ関数を使う。重複は各表の
 * UNIQUE が拒み、workerd の検査が確かめる
 */

describe('識別子の形', () => {
  it.each([
    'a',
    'my-app-2',
    'resume-2026',
    '0b6f3c1e-1111-4222-8333-444455556666',
    'a'.repeat(100),
  ])('%s を通す', (slug) => {
    expect(isSlug(slug)).toBe(true);
  });

  it.each(['', 'a'.repeat(101), 'A', 'Resume', 'my_app', 'my app', 'あ', 'résumé', 'a/b', 'a.b'])(
    '%j を拒む',
    (slug) => {
      expect(isSlug(slug)).toBe(false);
    },
  );
});

describe('新しい識別子', () => {
  it('uid（UUID v4）の形で、識別子の形を満たす', () => {
    const slug = newSlug();
    expect(slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isSlug(slug)).toBe(true);
  });

  it('作るたびに違う', () => {
    expect(newSlug()).not.toBe(newSlug());
  });
});
