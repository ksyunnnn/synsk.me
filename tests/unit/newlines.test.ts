import { describe, expect, it } from 'vitest';
import { normalizeNewlines } from '@/shared/domain/newlines';
import { formatPeriod, type Period } from '@/shared/domain/period';

/**
 * 入力の改行の揃え方（src/shared/domain/newlines.ts）と、管理画面の期間の文字列
 * （src/shared/domain/period.ts の formatPeriod）。各機能の入力の読み替えは、それぞれの検査が持つ
 */

describe('normalizeNewlines', () => {
  it('\\r\\n と \\r を \\n にする', () => {
    expect(normalizeNewlines('1\r\n2\r3\n4')).toBe('1\n2\n3\n4');
  });
});

describe('formatPeriod', () => {
  it('続いている期間は終わりを空にする', () => {
    const ongoing = { startedOn: '2020-04-01', endedOn: null } as Period;
    const ended = { startedOn: '2020-04-01', endedOn: '2022-03-31' } as Period;
    expect(formatPeriod(ongoing)).toBe('2020-04-01 〜 ');
    expect(formatPeriod(ended)).toBe('2020-04-01 〜 2022-03-31');
  });
});
