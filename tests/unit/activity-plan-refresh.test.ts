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

  it('1 回の取得の中で同じ項目が 2 回出たら、最初の 1 つだけを使う', () => {
    const plan = planRefresh(
      [],
      [
        fetched({ externalId: 'x', title: '一つ目' }),
        fetched({ externalId: 'x', title: '二つ目' }),
        fetched({ url: 'https://example.com/b' }),
        fetched({ url: 'https://example.com/b', title: '重なり' }),
      ],
    );

    expect(plan.inserts.map((item) => item.title)).toEqual(['一つ目', '作り物の記事 A']);
  });

  it('取得元が画像を返さなくなったら、画像の URL を空にする', () => {
    const plan = planRefresh(
      [stored({ id: 8, imageUrl: 'https://example.com/a.png' })],
      [fetched()],
    );

    expect(plan.updates).toEqual([{ id: 8, changes: { imageUrl: null } }]);
  });

  it('URL は normalizeWebUrl で揃えてから同じ項目かを判定する（FR-005）', () => {
    const plan = planRefresh(
      [stored({ id: 9, url: 'https://example.com/a' })],
      [fetched({ url: 'HTTPS://EXAMPLE.COM:443/a#section' })],
    );

    expect(plan).toEqual({ inserts: [], updates: [], skippedWithoutDate: 0 });
  });

  it('足す行の URL は揃えた値で書く。揃えていない保存した URL は揃えた値に直す', () => {
    const inserted = planRefresh([], [fetched({ url: 'https://Example.com/b#top' })]);
    expect(inserted.inserts[0]?.url).toBe('https://example.com/b');

    const updated = planRefresh(
      [stored({ id: 10, externalId: 'x', url: 'https://Example.com/c#top' })],
      [fetched({ externalId: 'x', url: 'https://example.com/c' })],
    );
    expect(updated.updates).toEqual([{ id: 10, changes: { url: 'https://example.com/c' } }]);
  });

  it('揃えると同じ値になる保存した行が 2 つあれば、揃えた値で保存した行を使い、直す行を出さない', () => {
    const plan = planRefresh(
      [
        stored({ id: 12, url: 'https://example.com/d' }),
        stored({ id: 13, url: 'https://example.com/d#top' }),
      ],
      [fetched({ url: 'https://example.com/d' })],
    );

    // id 13 を揃えた値に直すと、id 12 と UNIQUE (source, url) に当たる
    expect(plan).toEqual({ inserts: [], updates: [], skippedWithoutDate: 0 });
  });

  it('末尾のスラッシュとクエリは揃えない。別の資源を指しうる（src/shared/domain/web-url.ts）', () => {
    const plan = planRefresh([stored({ id: 11 })], [fetched({ url: 'https://example.com/a/' })]);

    expect(plan.inserts.map((item) => item.url)).toEqual(['https://example.com/a/']);
  });
});
