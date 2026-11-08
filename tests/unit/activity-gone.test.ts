import { describe, expect, it } from 'vitest';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import {
  MAX_CHECKS_PER_FETCH,
  MAX_REMOVALS_PER_FETCH,
  selectGoneCandidates,
  selectRemovals,
  type StoredActivityKey,
} from '@/features/activity/domain/gone';

/**
 * 取得元で消えたかを確かめる候補と、消す件数（specs/004-external-activity/spec.md の
 * FR-017〜FR-020・SC-003・SC-004、research.md の R7）。値はすべて作り物
 */

const stored = (id: number, publishedAt: string, externalId: string | null = null) =>
  ({
    id,
    externalId,
    url: `https://example.com/${id}`,
    publishedAt,
  }) satisfies StoredActivityKey;

const item = (id: number, publishedAt: string, externalId: string | null = null): FetchedItem => ({
  externalId,
  url: `https://example.com/${id}`,
  title: `作り物 ${id}`,
  publishedAt,
  imageUrl: null,
});

describe('selectGoneCandidates', () => {
  it('取り直した一覧にある activity は候補にしない。ID を持つものは ID で照らす', () => {
    const rows = [
      stored(1, '2026-01-01T00:00:00.000Z', 'a'),
      stored(2, '2026-01-02T00:00:00.000Z'),
    ];
    // URL が変わっても、ID が同じなら同じ項目
    const fetched = [
      { ...item(9, '2026-01-01T00:00:00.000Z', 'a') },
      item(2, '2026-01-02T00:00:00.000Z'),
    ];
    expect(selectGoneCandidates(rows, { items: fetched, isComplete: true })).toEqual([]);
  });

  it('件数が決まっている取得元で、一覧の最も古い公開日より前の activity を候補にしない（FR-018）', () => {
    const rows = [
      stored(1, '2025-01-01T00:00:00.000Z'),
      stored(2, '2026-02-01T00:00:00.000Z'),
      stored(3, '2026-03-01T00:00:00.000Z'),
    ];
    const fetched = [item(3, '2026-03-01T00:00:00.000Z'), item(4, '2026-01-15T00:00:00.000Z')];
    expect(
      selectGoneCandidates(rows, { items: fetched, isComplete: false }).map((row) => row.id),
    ).toEqual([2]);
  });

  it('件数が決まっている取得元で、取り直した一覧が空なら候補にしない', () => {
    expect(
      selectGoneCandidates([stored(1, '2026-01-01T00:00:00.000Z')], {
        items: [],
        isComplete: false,
      }),
    ).toEqual([]);
  });

  it('すべての項目を含む一覧なら、一覧に無い activity をすべて候補にする', () => {
    expect(
      selectGoneCandidates([stored(1, '2020-01-01T00:00:00.000Z')], {
        items: [],
        isComplete: true,
      }),
    ).toHaveLength(1);
  });

  it('候補は新しい順に上限まで', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      stored(i + 1, `2026-01-0${i + 1}T00:00:00.000Z`),
    );
    const candidates = selectGoneCandidates(rows, { items: [], isComplete: true });
    expect(candidates).toHaveLength(MAX_CHECKS_PER_FETCH);
    expect(candidates[0].id).toBe(8);
  });
});

describe('selectRemovals', () => {
  it('gone だけを消し、判定できないものは残す（FR-020）', () => {
    expect(
      selectRemovals([
        { id: 1, check: 'gone' },
        { id: 2, check: 'unknown' },
        { id: 3, check: 'present' },
      ]),
    ).toEqual([1]);
  });

  it('上限を超えた分は残す（FR-019）', () => {
    const checks = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, check: 'gone' as const }));
    expect(selectRemovals(checks)).toHaveLength(MAX_REMOVALS_PER_FETCH);
  });
});
