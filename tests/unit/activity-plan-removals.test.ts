import { describe, expect, it } from 'vitest';
import { planRemovals } from '@/features/activity/application/plan-removals';
import type { StoredItem } from '@/features/activity/domain/activity-repository';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';

/**
 * 取得元で消えた activity の消す行を求める計算（User Story 3、specs/004-external-activity/research.md
 * の R6、FR-017〜FR-020・SC-003・SC-004）。値はすべて作り物
 */

const stored = (id: number, overrides: Partial<StoredItem> = {}): StoredItem => ({
  id,
  externalId: null,
  url: `https://example.com/${id}`,
  title: `作り物の記事 ${id}`,
  publishedAt: '2025-01-01T00:00:00.000Z',
  imageUrl: null,
  ...overrides,
});

const fetched = (id: number, overrides: Partial<FetchedItem> = {}): FetchedItem => ({
  url: `https://example.com/${id}`,
  title: `作り物の記事 ${id}`,
  publishedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('planRemovals', () => {
  it('すべて取ったとき、一覧に無い activity を消す行にする（FR-017）', () => {
    const plan = planRemovals([stored(1), stored(2)], { items: [fetched(1)], isComplete: true }, 5);

    expect(plan).toEqual({ deletes: [2], keptOverLimit: 0 });
  });

  it('すべて取っていないときは、一覧に無いことで消さない（FR-018・SC-004）', () => {
    const plan = planRemovals(
      [stored(1), stored(2)],
      { items: [fetched(1)], isComplete: false },
      5,
    );

    expect(plan).toEqual({ deletes: [], keptOverLimit: 0 });
  });

  it('ID を返す取得元は ID で、一覧にあるかを判定する', () => {
    const plan = planRemovals(
      [stored(1, { externalId: 'x1' }), stored(2, { externalId: 'x2' })],
      { items: [fetched(9, { externalId: 'x1' })], isComplete: true },
      5,
    );

    expect(plan.deletes).toEqual([2]);
  });

  it('消す候補が上限ちょうどなら、すべて消す', () => {
    const plan = planRemovals([stored(1), stored(2)], { items: [], isComplete: true }, 2);

    expect(plan).toEqual({ deletes: [1, 2], keptOverLimit: 0 });
  });

  it('消す候補が上限を超えたら、1 件も消さず、残した数を返す（FR-019、2026-11-09 の決定）', () => {
    const plan = planRemovals(
      [stored(1), stored(2), stored(3)],
      { items: [], isComplete: true },
      2,
    );

    expect(plan).toEqual({ deletes: [], keptOverLimit: 3 });
  });
});
