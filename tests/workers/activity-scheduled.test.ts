import { env, applyD1Migrations } from 'cloudflare:test';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runScheduled } from '../../worker/scheduled';
import { deleteActivityRows, readActivityRows, readFetchResult } from '../support/activity-rows';

/**
 * 定期実行の入口（worker/scheduled.ts、specs/004-external-activity/tasks.md の T040）を、本番と
 * 同じ組み立て用の関数で、workerd の D1 と R2 に対して確かめる。外への要求は作り物の `fetch` が
 * 答える。値はすべて作り物
 */

const ZENN_FEED = 'https://zenn.dev/ksyunnnn/feed';
const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>作り物のフィード</title>
<item><title>作り物の記事</title><link>https://zenn.dev/ksyunnnn/articles/0000000000fake</link><guid isPermaLink="true">https://zenn.dev/ksyunnnn/articles/0000000000fake</guid><pubDate>Tue, 09 Sep 2025 08:02:10 GMT</pubDate></item>
</channel></rss>`;

/** 置いた画像の猶予（1 日）を過ぎた日の UTC の 0 時と 3 時 */
const day = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const MIDNIGHT = new Date(`${day}T00:00:00.000Z`).getTime();
const THREE = new Date(`${day}T03:00:00.000Z`).getTime();

const requested: string[] = [];

const keysInBucket = async () => (await env.MEDIA.list()).objects.map((o) => o.key);

const putOrphanImage = async () => {
  const key = crypto.randomUUID();
  await env.MEDIA.put(key, new Uint8Array([1]));
  return key;
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteActivityRows(env.DB);
  const keys = await keysInBucket();
  if (keys.length > 0) await env.MEDIA.delete(keys);
  requested.length = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    requested.push(url);
    return url === ZENN_FEED
      ? new Response(rss, { headers: { 'Content-Type': 'application/rss+xml' } })
      : new Response('', { status: 404 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runScheduled', () => {
  it('1 回の起動で、一覧を取る取得元を 1 つだけ取り直し、取得の結果を書く', async () => {
    await runScheduled(MIDNIGHT);

    expect(requested).toEqual([ZENN_FEED]);
    expect(await readFetchResult(env.DB, 'zenn')).toEqual(
      expect.objectContaining({ is_ok: 1, reason: null }),
    );
    expect((await readActivityRows(env.DB, 'zenn')).map((row) => row.url)).toEqual([
      'https://zenn.dev/ksyunnnn/articles/0000000000fake',
    ]);
    expect(await readFetchResult(env.DB, 'qiita')).toBeNull();
  });

  it('次の起動は、取り直したことの無い次の取得元を選び、失敗を取得の結果に書く', async () => {
    await runScheduled(MIDNIGHT);
    requested.length = 0;

    await runScheduled(THREE);

    expect(requested).not.toEqual([]);
    expect(requested.every((url) => url.startsWith('https://qiita.com/'))).toBe(true);
    const qiita = await readFetchResult(env.DB, 'qiita');
    expect(qiita).toEqual(expect.objectContaining({ is_ok: 0 }));
    expect(qiita?.fetched_at).toBe(new Date(THREE).toISOString());
  });

  it('UTC の 0 時の回は、消し損ねた画像を消す', async () => {
    await putOrphanImage();
    await runScheduled(MIDNIGHT);
    expect(await keysInBucket()).toEqual([]);
  });

  it('ほかの回は、消し損ねた画像を消さない', async () => {
    const orphan = await putOrphanImage();
    await runScheduled(THREE);
    expect(await keysInBucket()).toEqual([orphan]);
  });
});
