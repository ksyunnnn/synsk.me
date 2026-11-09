import { describe, expect, it } from 'vitest';
import { planRefresh } from '@/features/activity/application/plan-refresh';
import type { StoredItem } from '@/features/activity/domain/activity-repository';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';

/**
 * 取り直しで足す行・直す行を求める計算（specs/004-external-activity/research.md の R5、
 * FR-005・FR-008・FR-011・FR-012・SC-001）。値はすべて作り物
 */

const stored = (overrides: Partial<StoredItem> = {}): StoredItem => ({
  id: 1,
  externalId: null,
  url: 'https://example.com/a',
  title: '作り物の記事 A',
  publishedAt: '2025-01-01T00:00:00.000Z',
  imageUrl: null,
  ...overrides,
});

const fetched = (overrides: Partial<FetchedItem> = {}): FetchedItem => ({
  url: 'https://example.com/a',
  title: '作り物の記事 A',
  publishedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('planRefresh', () => {
  it('保存していない項目を足す行にする', () => {
    const plan = planRefresh([], [fetched()]);

    expect(plan.inserts).toEqual([fetched()]);
    expect(plan.updates).toEqual([]);
  });

  it('値の変わらない項目は書かない', () => {
    const plan = planRefresh([stored()], [fetched()]);

    expect(plan).toEqual({ inserts: [], updates: [], skippedWithoutDate: 0 });
  });

  it('値の変わった項目は、変わった列だけを直す行にする', () => {
    const plan = planRefresh(
      [stored({ id: 7 })],
      [fetched({ title: '直した題', imageUrl: 'https://example.com/a.png' })],
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      { id: 7, changes: { title: '直した題', imageUrl: 'https://example.com/a.png' } },
    ]);
  });

  it('ID を返す取得元は ID で同じ項目を判定する。URL が変わっても 1 行のまま直す', () => {
    const plan = planRefresh(
      [stored({ id: 3, externalId: 'x1', url: 'https://example.com/old' })],
      [fetched({ externalId: 'x1', url: 'https://example.com/new' })],
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([{ id: 3, changes: { url: 'https://example.com/new' } }]);
  });

  it('ID を返さない取得元は URL で同じ項目を判定する', () => {
    const plan = planRefresh(
      [stored({ id: 4 })],
      [fetched(), fetched({ url: 'https://example.com/b', title: '作り物の記事 B' })],
    );

    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([
      fetched({ url: 'https://example.com/b', title: '作り物の記事 B' }),
    ]);
  });

  it('ID を持つ行と、URL が同じでも ID の無い項目を同じ項目にしない', () => {
    const plan = planRefresh([stored({ externalId: 'x1' })], [fetched()]);

    expect(plan.inserts).toEqual([fetched()]);
  });

  it('公開日の無い項目で、保存した公開日を書き換えない（FR-012）', () => {
    const plan = planRefresh(
      [stored({ id: 5 })],
      [fetched({ publishedAt: undefined, title: '直した題' })],
    );

    expect(plan.updates).toEqual([{ id: 5, changes: { title: '直した題' } }]);
  });

  it('公開日が変わったら直す', () => {
    const plan = planRefresh(
      [stored({ id: 6 })],
      [fetched({ publishedAt: '2025-02-01T00:00:00.000Z' })],
    );

    expect(plan.updates).toEqual([{ id: 6, changes: { publishedAt: '2025-02-01T00:00:00.000Z' } }]);
  });

  it('公開日の無い新しい項目は足さず、数を返す（FR-011）', () => {
    const plan = planRefresh([], [fetched({ publishedAt: undefined })]);

    expect(plan.inserts).toEqual([]);
    expect(plan.skippedWithoutDate).toBe(1);
  });

  it('取得元が画像を返さなくなったら、画像の URL を空にする', () => {
    const plan = planRefresh(
      [stored({ id: 8, imageUrl: 'https://example.com/a.png' })],
      [fetched()],
    );

    expect(plan.updates).toEqual([{ id: 8, changes: { imageUrl: null } }]);
  });
});
