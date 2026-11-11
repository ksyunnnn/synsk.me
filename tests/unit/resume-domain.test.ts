import { describe, expect, it } from 'vitest';
import { canChangeSlug, parseResumeId } from '@/features/resume/domain/resume';

/**
 * 職務経歴書の識別子の決まり（specs/002-resume/spec.md の FR-002・FR-037・FR-039）。
 * 形と既定値は tests/unit/slug.test.ts が持つ。重複はスキーマの UNIQUE が拒み、
 * tests/workers/resume-repository.test.ts が確かめる
 */

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
