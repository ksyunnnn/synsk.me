import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import { createD1ActivityRepository } from '@/features/activity/server/d1-activity-repository';
import {
  deleteActivityRows,
  insertExternalActivity,
  insertLifeEvent,
} from '../support/activity-rows';

/**
 * 外部の activity の D1 の実装（specs/004-external-activity/spec.md の FR-008・FR-012・
 * FR-013・FR-016・FR-032・FR-033・SC-001、research.md の R5・R7）。値はすべて作り物
 */

const activities = createD1ActivityRepository(env.DB);

const T1 = '2026-11-09T00:00:00.000Z';
const T2 = '2026-11-09T08:00:00.000Z';
const T3 = '2026-11-09T16:00:00.000Z';

const zennItem = (overrides: Partial<FetchedItem> = {}): FetchedItem => ({
  externalId: null,
  url: 'https://zenn.dev/ksyunnnn/articles/fake-a',
  title: '作り物の記事 A',
  publishedAt: '2025-09-09T08:02:10.000Z',
  imageUrl: null,
  ...overrides,
});

const ok = (fetchedAt: string) => ({ fetchedAt, isOk: true, reason: 'ok' });

const rowsOf = async (source: string) =>
  (
    await env.DB.prepare(
      'SELECT id, title, url, external_id, published_at, created_at, updated_at FROM activity WHERE source = ? ORDER BY id',
    )
      .bind(source)
      .all<{
        id: number;
        title: string;
        url: string;
        external_id: string | null;
        published_at: string;
        created_at: string;
        updated_at: string;
      }>()
  ).results;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteActivityRows(env.DB);
});

describe('applyFetch（同じ項目の判定と書き方）', () => {
  it('取得元が ID を返さない項目は、URL で 1 行にする（FR-008・SC-001、User Story 1 の 2・3）', async () => {
    await activities.applyFetch('zenn_article', {
      items: [zennItem()],
      removeIds: [],
      result: ok(T1),
    });
    await activities.applyFetch('zenn_article', {
      items: [zennItem()],
      removeIds: [],
      result: ok(T2),
    });
    expect(await rowsOf('zenn_article')).toHaveLength(1);
  });

  it('取得元が ID を返す項目は、URL が変わっても ID で 1 行にする', async () => {
    const item = (url: string) => zennItem({ externalId: 'fake-1', url, title: '作り物の Qiita' });
    await activities.applyFetch('qiita_article', {
      items: [item('https://qiita.com/ksyunnnn/items/a')],
      removeIds: [],
      result: ok(T1),
    });
    await activities.applyFetch('qiita_article', {
      items: [item('https://qiita.com/ksyunnnn/items/b')],
      removeIds: [],
      result: ok(T2),
    });
    const rows = await rowsOf('qiita_article');
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('https://qiita.com/ksyunnnn/items/b');
  });

  it('値が変わらない行は書かず、初めて取り込んだ日時は変わらない（FR-013、research.md の R5）', async () => {
    const first = await activities.applyFetch('zenn_article', {
      items: [zennItem()],
      removeIds: [],
      result: ok(T1),
    });
    expect(first.written).toBe(1);
    const [before] = await rowsOf('zenn_article');

    const same = await activities.applyFetch('zenn_article', {
      items: [zennItem()],
      removeIds: [],
      result: ok(T2),
    });
    expect(same.written).toBe(0);
    expect(await rowsOf('zenn_article')).toEqual([before]);

    const changed = await activities.applyFetch('zenn_article', {
      items: [zennItem({ title: '直した題' })],
      removeIds: [],
      result: ok(T3),
    });
    expect(changed.written).toBe(1);
    const [after] = await rowsOf('zenn_article');
    expect(after.title).toBe('直した題');
    expect(after.created_at).toBe(before.created_at);
  });

  it('removeIds の行を、その取得元の行に限って消す。life event を消さない（FR-032）', async () => {
    const gone = await insertExternalActivity(env.DB, { source: 'zenn_article' });
    const other = await insertExternalActivity(env.DB, { source: 'qiita_article' });
    const lifeEvent = await insertLifeEvent(env.DB);
    const { removed } = await activities.applyFetch('zenn_article', {
      items: [],
      removeIds: [gone, other, lifeEvent],
      result: ok(T1),
    });
    expect(removed).toBe(1);
    const ids = (
      await env.DB.prepare('SELECT id FROM activity ORDER BY id').all<{ id: number }>()
    ).results.map((row) => row.id);
    expect(ids).toEqual([other, lifeEvent]);
  });
});

describe('取得の結果（FR-016）', () => {
  it('失敗が続いても、最後に成功した日時を残す（User Story 2 の 3・4）', async () => {
    await activities.applyFetch('zenn_article', { items: [], removeIds: [], result: ok(T1) });
    await activities.recordFetchResult('zenn_article', {
      fetchedAt: T2,
      isOk: false,
      reason: '状態 503 を返した',
    });
    await activities.recordFetchResult('zenn_article', {
      fetchedAt: T3,
      isOk: false,
      reason: '10 秒で応答が無い',
    });
    expect(await activities.listFetchResults()).toEqual([
      {
        source: 'zenn_article',
        fetchedAt: T3,
        isOk: false,
        reason: '10 秒で応答が無い',
        lastSucceededAt: T1,
      },
    ]);
  });

  it('取得の結果は取得元ごとに 1 つ', async () => {
    await activities.recordFetchResult('zenn_article', { fetchedAt: T1, isOk: false, reason: 'a' });
    await activities.recordFetchResult('zenn_article', { fetchedAt: T2, isOk: false, reason: 'b' });
    expect(await activities.listFetchResults()).toHaveLength(1);
  });
});

describe('オーナーの登録・書き換え・削除', () => {
  const registered = {
    externalId: '1',
    url: 'https://x.com/ksyunnnn/status/1',
    title: '作り物の投稿',
    imageUrl: null,
    publishedAt: '2026-01-01T15:00:00.000Z',
  };

  it('登録した行の uid から id を引き、同じ項目の 2 つ目を拒む', async () => {
    const result = await activities.register('x_post', registered);
    if (!result.ok) throw new Error(result.reason);
    expect(result.uid).toMatch(/^[0-9a-f]{32}$/);
    expect(await activities.findIdByUid(result.uid)).toBe(result.id);
    expect(await activities.register('x_post', registered)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('登録していないサイトの同じ URL の 2 つ目を拒む（FR-005）', async () => {
    const item = { ...registered, externalId: null, url: 'https://example.com/a' };
    await activities.register('unlisted', item);
    expect(await activities.register('unlisted', item)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('life event の uid は外部の activity として引けない', async () => {
    const id = await insertLifeEvent(env.DB);
    const { uid } = (await env.DB.prepare('SELECT uid FROM activity WHERE id = ?')
      .bind(id)
      .first<{ uid: string }>())!;
    expect(await activities.findIdByUid(uid)).toBeNull();
    expect(await activities.findForEdit(id)).toBeNull();
    expect(await activities.delete(id)).toEqual({ ok: false });
  });

  it('URL を指名した activity の取り直しは、日付を書き換えない（FR-012・SC-005）', async () => {
    const result = await activities.register('spotify_playlist', {
      ...registered,
      externalId: 'fake',
      url: 'https://open.spotify.com/playlist/fake',
    });
    if (!result.ok) throw new Error(result.reason);
    await activities.applyRefresh({
      updates: [{ id: result.id, title: '取り直した題', imageUrl: 'https://mosaic.scdn.co/fake' }],
      removeIds: [],
      results: [{ source: 'spotify_playlist', result: ok(T1) }],
    });
    expect(await activities.findForEdit(result.id)).toMatchObject({
      title: '取り直した題',
      imageUrl: 'https://mosaic.scdn.co/fake',
      publishedAt: registered.publishedAt,
    });
  });

  it('取り直しの対象を id の順に巡り、末尾を過ぎたら先頭に戻る', async () => {
    const ids = [];
    for (const n of [1, 2, 3]) {
      ids.push(
        await insertExternalActivity(env.DB, {
          source: 'x_post',
          externalId: String(n),
          url: `https://x.com/a/status/${n}`,
        }),
      );
    }
    await insertExternalActivity(env.DB, { source: 'zenn_article' });
    const targets = await activities.listRefreshTargets(['x_post'], 2, 2);
    expect(targets.map((t) => t.id)).toEqual([ids[2], ids[0]]);
  });

  it('書き換えと物理削除（FR-033）', async () => {
    const result = await activities.register('unlisted', {
      ...registered,
      externalId: null,
      url: 'https://example.com/a',
    });
    if (!result.ok) throw new Error(result.reason);
    expect(
      await activities.edit(result.id, {
        url: 'https://example.com/b',
        externalId: null,
        title: '直した題',
        publishedAt: '2026-02-01T15:00:00.000Z',
      }),
    ).toEqual({ ok: true });
    expect(await activities.findForEdit(result.id)).toMatchObject({
      url: 'https://example.com/b',
      title: '直した題',
    });
    expect(await activities.delete(result.id)).toEqual({ ok: true });
    expect(await activities.findForEdit(result.id)).toBeNull();
  });
});
