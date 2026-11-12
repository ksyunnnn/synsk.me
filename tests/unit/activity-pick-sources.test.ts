import { describe, expect, it } from 'vitest';
import { pickSourcesForRun } from '@/features/activity/domain/pick-sources';

/**
 * 1 回の実行で取り直す取得元を、上限の数まで、最後に取り直した日時の古い順に選ぶ
 * （specs/004-external-activity/research.md の R9、原則 2・4）。取得元の名前と日時は作り物
 */

const SOURCES = ['a', 'b', 'c', 'd'];

describe('pickSourcesForRun', () => {
  it('取り直したことの無い取得元を先に、表の順で選ぶ', () => {
    expect(pickSourcesForRun(SOURCES, {}, 2)).toEqual(['a', 'b']);
  });

  it('前の回の続きから選ぶ。最後に取り直した日時の古い順', () => {
    const fetchedAt = {
      a: '2026-11-09T00:00:00.000Z',
      b: '2026-11-09T00:00:00.000Z',
      c: '2026-11-08T00:00:00.000Z',
    };

    expect(pickSourcesForRun(SOURCES, fetchedAt, 2)).toEqual(['d', 'c']);
  });

  it('上限の数が取得元の数以上なら、すべて選ぶ', () => {
    expect(pickSourcesForRun(SOURCES, {}, 10)).toEqual(SOURCES);
  });

  it('同じ日時の取得元は表の順で選ぶ', () => {
    const at = '2026-11-09T00:00:00.000Z';

    expect(pickSourcesForRun(SOURCES, { a: at, b: at, c: at, d: at }, 3)).toEqual(['a', 'b', 'c']);
  });

  it('選んだ取得元の日時を進めながら回すと、取得元の数の回でどれも 1 度ずつ選ばれる', () => {
    const fetchedAt: Record<string, string> = {};
    const picked = SOURCES.map((_, run) => {
      const [name = ''] = pickSourcesForRun(SOURCES, fetchedAt, 1);
      fetchedAt[name] = `2026-11-0${run + 1}T00:00:00.000Z`;
      return name;
    });

    expect(picked).toEqual(SOURCES);
  });

  it('上限の数が 0 以下なら、どれも選ばない', () => {
    expect(pickSourcesForRun(SOURCES, {}, 0)).toEqual([]);
  });
});
