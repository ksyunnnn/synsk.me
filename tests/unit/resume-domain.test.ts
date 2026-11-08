import { describe, expect, it } from 'vitest';
import {
  canChangeSlug,
  isResumeSlug,
  newResumeSlug,
  parseResumeId,
} from '@/features/resume/domain/resume';

/**
 * 職務経歴書の識別子の決まり（specs/002-resume/spec.md の FR-002・FR-037・FR-039）。
 * 重複はスキーマの UNIQUE が拒み、tests/workers/resume-repository.test.ts が確かめる
 */

describe('識別子の形（FR-002）', () => {
  it.each(['a', 'resume', 'resume-2026', '0b6f3c1e-1111-4222-8333-444455556666', 'a'.repeat(100)])(
    '%s を通す',
    (slug) => {
      expect(isResumeSlug(slug)).toBe(true);
    },
  );

  it.each(['', 'a'.repeat(101), 'Resume', 'resume_2026', 'résumé', 'a b', 'a/b', 'a.b'])(
    '%s を拒む',
    (slug) => {
      expect(isResumeSlug(slug)).toBe(false);
    },
  );
});

describe('新しい識別子（FR-037・FR-039）', () => {
  it('uid の形で、識別子の形を満たす', () => {
    const slug = newResumeSlug();
    expect(slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isResumeSlug(slug)).toBe(true);
  });

  it('作るたびに違う', () => {
    expect(newResumeSlug()).not.toBe(newResumeSlug());
  });
});

describe('識別子の書き換え', () => {
  it('限定公開用は拒む（FR-037）', () => {
    expect(canChangeSlug('limited')).toBe(false);
  });

  it('公開用は許す（FR-039）', () => {
    expect(canChangeSlug('public')).toBe(true);
  });
});

describe('id', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('%s を読む', (value, id) => {
    expect(parseResumeId(value)).toBe(id);
  });

  it.each(['', '0', '-1', '1.5', 'abc', '01'])('%s を拒む', (value) => {
    expect(parseResumeId(value)).toBeNull();
  });

  it.each(['9007199254740992', '9007199254740993', '9999999999999999'])(
    'Number.MAX_SAFE_INTEGER を超える %s は、精度を失うため拒む',
    (value) => {
      expect(parseResumeId(value)).toBeNull();
    },
  );
});
