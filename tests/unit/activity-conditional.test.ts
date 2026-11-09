import { describe, expect, it } from 'vitest';
import type { ActivityDeps } from '@/features/activity/application/deps';
import { refreshSources } from '@/features/activity/application/refresh-sources';
import type { RefreshLimits } from '@/features/activity/domain/limits';
import { createSourceHttp } from '@/features/activity/server/sources/fetch-with-limits';
import { fetchListing as fetchMedium } from '@/features/activity/server/sources/medium';
import { fetchListing as fetchQiita } from '@/features/activity/server/sources/qiita';
import { fetchListing as fetchSpeakerDeck } from '@/features/activity/server/sources/speakerdeck';
import { fetchListing as fetchZenn } from '@/features/activity/server/sources/zenn';
import { createFakeActivityRepository, createFakeFetcher } from '../support/activity-fakes';

/**
 * 条件付きの要求（T041、specs/004-external-activity/research.md の R9）。取得元が返した ETag と
 * Last-Modified を次の要求に付け、304 なら中身を読まず、activity を書かない。値はすべて作り物
 */

const LIMITS: RefreshLimits = {
  maxRequests: 3,
  timeoutMs: 1000,
  maxBytes: 100_000,
  maxRemovals: 5,
};
const NOW = '2026-11-09T00:00:00.000Z';
const ETAG = 'W/"fake-etag"';
const LAST_MODIFIED = 'Mon, 09 Nov 2026 05:27:54 GMT';

const rss = (item = '') =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>作り物</title>${item}</channel></rss>`;
const ITEM =
  '<item><title>作り物の記事</title><link>https://example.com/a</link><guid>https://example.com/a</guid><pubDate>Tue, 09 Sep 2025 08:02:10 GMT</pubDate></item>';

const respond =
  (body: string, headers: Record<string, string> = {}, status = 200) =>
  () =>
    new Response(status === 304 ? null : body, { status, headers });

describe('createSourceHttp の 304', () => {
  it('304 は失敗にせず、本文の無い応答として返す', async () => {
    const http = createSourceHttp(async () => new Response(null, { status: 304 }), LIMITS);

    expect((await http.get('https://example.com/feed')).status).toBe(304);
  });
});

describe('RSS の取得元', () => {
  it('Zenn は Last-Modified を持ち、次の要求に If-Modified-Since を付け、304 なら変わっていないと返す', async () => {
    const feed = 'https://zenn.dev/ksyunnnn/feed';
    const first = createFakeFetcher({
      [feed]: respond(rss(ITEM), { 'Last-Modified': LAST_MODIFIED }),
    });
    const listing = await fetchZenn(first.fetcher, LIMITS);
    expect('items' in listing && listing.validators).toEqual({
      etag: null,
      lastModified: LAST_MODIFIED,
    });

    const second = createFakeFetcher({ [feed]: respond('', {}, 304) });
    expect(
      await fetchZenn(second.fetcher, LIMITS, { etag: null, lastModified: LAST_MODIFIED }),
    ).toEqual({ notModified: true });
    expect(second.requested[0]?.headers.get('If-Modified-Since')).toBe(LAST_MODIFIED);
  });

  it('Speaker Deck は ETag を持ち、次の要求に If-None-Match を付ける', async () => {
    const feed = 'https://speakerdeck.com/ksyunnnn.rss';
    const first = createFakeFetcher({ [feed]: respond(rss(ITEM), { ETag: ETAG }) });
    const listing = await fetchSpeakerDeck(first.fetcher, LIMITS);
    expect('items' in listing && listing.validators).toEqual({ etag: ETAG, lastModified: null });

    const second = createFakeFetcher({ [feed]: respond('', {}, 304) });
    await fetchSpeakerDeck(second.fetcher, LIMITS, { etag: ETAG, lastModified: null });
    expect(second.requested[0]?.headers.get('If-None-Match')).toBe(ETAG);
  });

  it('Medium はどちらも返さないので、値を持たず、条件を付けない', async () => {
    const feed = 'https://medium.com/feed/@ksyunnnn';
    const medium = rss(
      '<item><title>作り物</title><link>https://medium.com/fake</link><guid>https://medium.com/p/fake</guid><pubDate>Sun, 03 Jan 2021 12:13:20 GMT</pubDate></item>',
    );
    const { fetcher, requested } = createFakeFetcher({ [feed]: respond(medium) });

    const listing = await fetchMedium(fetcher, LIMITS);

    expect('items' in listing && listing.validators).toBeUndefined();
    expect(requested[0]?.headers.has('If-None-Match')).toBe(false);
  });
});

describe('Qiita', () => {
  const page = (n: number) => `https://qiita.com/api/v2/users/ksyunnnn/items?page=${n}&per_page=20`;
  const item = (n: number) => ({
    id: `fake${n}`,
    title: `作り物 ${n}`,
    url: `https://qiita.com/ksyunnnn/items/fake${n}`,
    created_at: '2022-05-19T10:20:46+09:00',
  });

  it('1 頁で取り切ったときだけ値を持つ', async () => {
    const one = createFakeFetcher({
      [page(1)]: respond(JSON.stringify([item(1)]), { 'Total-Count': '1', ETag: ETAG }),
    });
    const listing = await fetchQiita(one.fetcher, LIMITS);
    expect('items' in listing && listing.validators).toEqual({ etag: ETAG, lastModified: null });

    const items = Array.from({ length: 20 }, (_, i) => item(i + 1));
    const two = createFakeFetcher({
      [page(1)]: respond(JSON.stringify(items), { 'Total-Count': '21', ETag: ETAG }),
      [page(2)]: respond(JSON.stringify([item(21)]), { 'Total-Count': '21', ETag: 'W/"p2"' }),
    });
    const paged = await fetchQiita(two.fetcher, LIMITS);
    expect('items' in paged && paged.validators).toBeUndefined();
  });

  it('前の値があれば 1 頁目に条件を付け、304 なら変わっていないと返す', async () => {
    const { fetcher, requested } = createFakeFetcher({ [page(1)]: respond('', {}, 304) });

    expect(
      await fetchQiita(fetcher, LIMITS, undefined, { etag: ETAG, lastModified: null }),
    ).toEqual({ notModified: true });
    expect(requested[0]?.headers.get('If-None-Match')).toBe(ETAG);
  });
});

describe('refreshSources と条件付きの要求', () => {
  const item = { url: 'https://example.com/a', title: '作り物', publishedAt: NOW };

  const depsWith = (
    repository: ActivityDeps['activities'],
    fetchListing: ActivityDeps['fetchListing'],
  ): ActivityDeps => ({ activities: repository, fetchListing });

  it('持っていた値を取得元ごとの処理に渡し、304 なら activity を書かず、取得の結果を成功として書く', async () => {
    const { repository, applied, notModified } = createFakeActivityRepository(
      {},
      { validators: { fake_feed: { etag: ETAG, lastModified: null } } },
    );
    const seen: unknown[] = [];

    const outcomes = await refreshSources(
      depsWith(repository, async (_source, _limits, previous) => {
        seen.push(previous);
        return { notModified: true };
      }),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(seen).toEqual([{ etag: ETAG, lastModified: null }]);
    expect(applied).toEqual([]);
    expect(notModified).toEqual([{ source: 'fake_feed', fetchedAt: NOW }]);
    expect(outcomes).toMatchObject([{ source: 'fake_feed', ok: true, added: 0, updated: 0 }]);
  });

  it('取り込みを書き終えた取得元の値を、同じ書き込みで書く', async () => {
    const { repository, applied } = createFakeActivityRepository();

    await refreshSources(
      depsWith(repository, async () => ({
        items: [item],
        isComplete: false,
        validators: { etag: ETAG, lastModified: null },
      })),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.result.validators).toEqual({ etag: ETAG, lastModified: null });
  });

  it('公開日の欠けた項目を取り込まなかった回は値を書かない。次も中身を取る（R9）', async () => {
    const { repository, applied } = createFakeActivityRepository();

    await refreshSources(
      depsWith(repository, async () => ({
        items: [{ url: 'https://example.com/b', title: '公開日の無い作り物' }],
        isComplete: false,
        validators: { etag: ETAG, lastModified: null },
      })),
      ['fake_feed'],
      NOW,
      LIMITS,
    );

    expect(applied[0]?.result.validators).toBeNull();
  });
});
