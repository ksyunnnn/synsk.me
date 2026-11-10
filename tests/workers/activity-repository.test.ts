import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { refreshSources } from '@/features/activity/application/refresh-sources';
import type { GoneCheck } from '@/features/activity/domain/fetched-item';
import { SOURCES } from '@/features/activity/domain/sources';
import { planRefresh } from '@/features/activity/application/plan-refresh';
import {
  createD1ActivityRepository,
  createD1ExternalActivityRepository,
} from '@/features/activity/server/d1-activity-repository';
import {
  deleteActivityRows,
  insertActivity,
  insertLifeEvent,
  readActivityRows,
  readFetchResult,
} from '../support/activity-rows';

/**
 * `ActivityRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/004-external-activity/research.md の R4・R5・R13、FR-002・FR-008・FR-013・FR-016・FR-032）。
 * 値はすべて作り物
 */

const activities = createD1ActivityRepository(env.DB);

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const PUBLISHED = '2025-01-01T00:00:00.000Z';
const LIMITS = { maxRequests: 1, timeoutMs: 1000, maxBytes: 1000, maxRemovals: 5 };

const item = (n: number, overrides = {}) => ({
  url: `https://zenn.dev/ksyunnnn/articles/fake${n}`,
  title: `作り物の記事 ${n}`,
  publishedAt: PUBLISHED,
  ...overrides,
});

const insertsOnly = (inserts: ReturnType<typeof item>[]) => ({
  inserts,
  updates: [],
  deletes: [],
  skippedWithoutDate: 0,
});

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteActivityRows(env.DB);
});

describe('取得元の表', () => {
  it('src/features/activity/domain/sources.ts の取得元は、どれも activity_source の行にある（FR-002）', async () => {
    const { results } = await env.DB.prepare('SELECT source FROM activity_source').all<{
      source: string;
    }>();
    const stored = results.map((row) => row.source);

    expect(stored).toEqual(expect.arrayContaining(Object.keys(SOURCES)));
  });
});

describe('applyRefresh', () => {
  it('足す行と取得の結果を書き、取得元は activity_source の取得元になる', async () => {
    await activities.applyRefresh('zenn', insertsOnly([item(1)]), {
      fetchedAt: T1,
      reason: null,
      validators: null,
    });

    expect(await readActivityRows(env.DB, 'zenn')).toMatchObject([
      {
        external_id: null,
        url: 'https://zenn.dev/ksyunnnn/articles/fake1',
        title: '作り物の記事 1',
        published_at: PUBLISHED,
        image_url: null,
      },
    ]);
    expect(await readFetchResult(env.DB, 'zenn')).toEqual({
      fetched_at: T1,
      is_ok: 1,
      reason: null,
      last_succeeded_at: T1,
    });
  });

  it('直す行は渡した列だけを書き換え、初めて取り込んだ日時を変えない（FR-013）', async () => {
    const id = await insertActivity(env.DB, {
      source: 'qiita',
      externalId: 'fake1',
      url: 'https://qiita.com/ksyunnnn/items/fake1',
      title: '前の題',
      publishedAt: PUBLISHED,
      imageUrl: 'https://example.com/fake.png',
      createdAt: T1,
    });

    await activities.applyRefresh(
      'qiita',
      {
        inserts: [],
        updates: [{ id, changes: { title: '直した題' } }],
        deletes: [],
        skippedWithoutDate: 0,
      },
      { fetchedAt: T2, reason: null, validators: null },
    );

    expect(await readActivityRows(env.DB, 'qiita')).toEqual([
      {
        id,
        external_id: 'fake1',
        url: 'https://qiita.com/ksyunnnn/items/fake1',
        title: '直した題',
        published_at: PUBLISHED,
        image_url: 'https://example.com/fake.png',
        created_at: T1,
      },
    ]);
  });

  it('取得の書き込みは、ほかの取得元の行と life event の行を書き換えない（FR-032）', async () => {
    const lifeEventId = await insertLifeEvent(env.DB);
    const otherId = await insertActivity(env.DB, {
      source: 'medium',
      externalId: 'https://medium.com/p/fake',
      url: 'https://medium.com/fake',
      title: '作り物',
      publishedAt: PUBLISHED,
    });

    await activities.applyRefresh(
      'zenn',
      {
        inserts: [],
        updates: [
          { id: lifeEventId, changes: { title: '書き換えた' } },
          { id: otherId, changes: { title: '書き換えた' } },
        ],
        deletes: [],
        skippedWithoutDate: 0,
      },
      { fetchedAt: T1, reason: null, validators: null },
    );

    const titles = await env.DB.prepare('SELECT title FROM activity ORDER BY id').all<{
      title: string;
    }>();
    expect(titles.results.map((row) => row.title)).toEqual(['作り物の出来事', '作り物']);
  });

  it('1 文でも失敗したら、足す行も取得の結果も書かずに投げる（R4）', async () => {
    await expect(
      activities.applyRefresh('zenn', insertsOnly([item(1), item(1)]), {
        fetchedAt: T1,
        reason: null,
        validators: null,
      }),
    ).rejects.toThrow();

    expect(await readActivityRows(env.DB, 'zenn')).toEqual([]);
    expect(await readFetchResult(env.DB, 'zenn')).toBeNull();
  });

  it('同じ項目を取り直しても行が増えない（FR-008。同じ URL は UNIQUE が拒む）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([item(1)]), {
      fetchedAt: T1,
      reason: null,
      validators: null,
    });
    const [stored] = await activities.listStoredForRefresh('zenn');

    await activities.applyRefresh(
      'zenn',
      { inserts: [], updates: [], deletes: [], skippedWithoutDate: 0 },
      { fetchedAt: T2, reason: null, validators: null },
    );

    expect(await readActivityRows(env.DB, 'zenn')).toHaveLength(1);
    expect(stored).toEqual({
      id: expect.any(Number),
      externalId: null,
      url: 'https://zenn.dev/ksyunnnn/articles/fake1',
      title: '作り物の記事 1',
      publishedAt: PUBLISHED,
      imageUrl: null,
      goneCheckedAt: null,
      goneStreak: 0,
    });
  });
});

describe('listStoredForRefresh', () => {
  it('その取得元の行だけを返す', async () => {
    await insertLifeEvent(env.DB);
    await insertActivity(env.DB, {
      source: 'zenn',
      url: 'https://zenn.dev/a',
      publishedAt: PUBLISHED,
    });
    await insertActivity(env.DB, {
      source: 'medium',
      url: 'https://medium.com/a',
      publishedAt: PUBLISHED,
    });

    const stored = await activities.listStoredForRefresh('zenn');

    expect(stored.map((row) => row.url)).toEqual(['https://zenn.dev/a']);
  });
});

describe('recordFetchFailure', () => {
  it('失敗と理由を書き、最後に成功した日時を残す（FR-016）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T1,
      reason: null,
      validators: null,
    });

    await activities.recordFetchFailure('zenn', T2, '作り物の失敗');

    expect(await readFetchResult(env.DB, 'zenn')).toEqual({
      fetched_at: T2,
      is_ok: 0,
      reason: '作り物の失敗',
      last_succeeded_at: T1,
    });
  });
});

describe('listFetchedAt', () => {
  it('取得元ごとの最後に取り直した日時を返す。成否を問わない（research.md の R9）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T1,
      reason: null,
      validators: null,
    });
    await activities.recordFetchFailure('medium', T2, '作り物の失敗');

    expect(await activities.listFetchedAt()).toEqual({ zenn: T1, medium: T2 });
  });
});

/**
 * 取得元の失敗が、その取得元の取得の結果だけに残り、ほかの取得元を戻さない
 * （User Story 2 の Acceptance 3・4、FR-015・FR-016、research.md の R4）
 */
describe('取得元の失敗', () => {
  it('2 回続けて失敗しても、最後に成功した日時が前の値のまま残る', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T1,
      reason: null,
      validators: null,
    });

    await activities.recordFetchFailure('zenn', T2, '1 回目の作り物の失敗');
    await activities.recordFetchFailure('zenn', '2026-11-03T00:00:00.000Z', '2 回目の作り物の失敗');

    expect(await readFetchResult(env.DB, 'zenn')).toEqual({
      fetched_at: '2026-11-03T00:00:00.000Z',
      is_ok: 0,
      reason: '2 回目の作り物の失敗',
      last_succeeded_at: T1,
    });
  });

  it('取得元 A の書き込みが失敗しても、取得元 B の書き込みは戻らず、A の取得の結果に失敗が残る', async () => {
    const outcomes = await refreshSources(
      {
        activities,
        fetchListing: async (source) => ({
          items:
            source === 'zenn'
              ? // 2 件目の公開日が activity の CHECK に反し、A の batch() が 1 件目ごと戻る
                [item(1), item(2, { publishedAt: '形の違う日時' })]
              : [item(2, { url: 'https://medium.com/fake2', externalId: 'm2' })],
          isComplete: false,
        }),
      },
      ['zenn', 'medium'],
      T1,
      LIMITS,
    );

    expect(outcomes.map((outcome) => [outcome.source, outcome.ok])).toEqual([
      ['zenn', false],
      ['medium', true],
    ]);
    expect(await readActivityRows(env.DB, 'zenn')).toEqual([]);
    expect(await readActivityRows(env.DB, 'medium')).toHaveLength(1);
    expect(await readFetchResult(env.DB, 'zenn')).toMatchObject({
      fetched_at: T1,
      is_ok: 0,
      reason: expect.stringMatching(/書き込みに失敗した/),
      last_succeeded_at: null,
    });
    expect(await readFetchResult(env.DB, 'medium')).toMatchObject({
      is_ok: 1,
      last_succeeded_at: T1,
    });
  });

  it('取得に失敗した取得元の activity を書き換えない（FR-014）', async () => {
    const id = await insertActivity(env.DB, {
      source: 'zenn',
      url: 'https://zenn.dev/ksyunnnn/articles/fake1',
      title: '前の題',
      publishedAt: PUBLISHED,
    });

    await refreshSources(
      {
        activities,
        fetchListing: async () => {
          throw new Error('作り物の通信の失敗');
        },
      },
      ['zenn'],
      T1,
      LIMITS,
    );

    expect(await readActivityRows(env.DB, 'zenn')).toMatchObject([{ id, title: '前の題' }]);
    expect(await readFetchResult(env.DB, 'zenn')).toMatchObject({
      is_ok: 0,
      reason: expect.stringMatching(/作り物の通信の失敗/),
    });
  });
});

/**
 * 取得元で消えた activity の行を消す（User Story 3、FR-017・FR-032、research.md の R6）
 */
describe('消す行', () => {
  it('消す行が batch() で消え、life event とほかの取得元の行を消さない', async () => {
    const lifeEventId = await insertLifeEvent(env.DB);
    const otherId = await insertActivity(env.DB, {
      source: 'medium',
      externalId: 'https://medium.com/p/fake',
      url: 'https://medium.com/fake',
      publishedAt: PUBLISHED,
    });
    const goneId = await insertActivity(env.DB, {
      source: 'qiita',
      externalId: 'fake-gone',
      url: 'https://qiita.com/ksyunnnn/items/fake-gone',
      publishedAt: PUBLISHED,
    });

    await activities.applyRefresh(
      'qiita',
      { inserts: [], updates: [], deletes: [goneId, lifeEventId, otherId], skippedWithoutDate: 0 },
      { fetchedAt: T1, reason: null, validators: null },
    );

    const ids = await env.DB.prepare('SELECT id FROM activity ORDER BY id').all<{ id: number }>();
    expect(ids.results.map((row) => row.id)).toEqual([lifeEventId, otherId]);
  });

  it('すべて取った取得元で一覧から消えた activity は、取り直すと行が残らない（SC-003）', async () => {
    await insertActivity(env.DB, {
      source: 'qiita',
      externalId: 'fake-gone',
      url: 'https://qiita.com/ksyunnnn/items/fake-gone',
      publishedAt: PUBLISHED,
    });

    await refreshSources(
      {
        activities,
        fetchListing: async () => ({
          items: [
            {
              url: 'https://qiita.com/ksyunnnn/items/fake-kept',
              title: '残る作り物',
              publishedAt: PUBLISHED,
              externalId: 'fake-kept',
            },
          ],
          isComplete: true,
        }),
      },
      ['qiita'],
      T1,
      LIMITS,
    );

    expect(await readActivityRows(env.DB, 'qiita')).toMatchObject([{ external_id: 'fake-kept' }]);
  });
});

/**
 * 条件付きの要求の値（T041、research.md の R9、migrations/0014）
 */
describe('条件に使う値', () => {
  const VALIDATORS = { etag: 'W/"fake"', lastModified: 'Mon, 09 Nov 2026 05:27:54 GMT' };

  it('取り込みと同じ書き込みで値を書き、読み戻せる', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T1,
      reason: null,
      validators: VALIDATORS,
    });

    expect(await activities.readValidators('zenn')).toEqual(VALIDATORS);
    expect(await activities.readValidators('medium')).toBeNull();
  });

  it('値を持たない回の書き込みは、持っていた値を消す', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T1,
      reason: null,
      validators: VALIDATORS,
    });
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T2,
      reason: '作り物の理由',
      validators: null,
    });

    expect(await activities.readValidators('zenn')).toBeNull();
  });

  it('失敗を書いても値を残す。順番を取る書き込みも失敗として書くため（R9）', async () => {
    await activities.applyRefresh('zenn', insertsOnly([]), {
      fetchedAt: T1,
      reason: null,
      validators: VALIDATORS,
    });
    await activities.recordFetchFailure('zenn', T2, '作り物の失敗');

    expect(await activities.readValidators('zenn')).toEqual(VALIDATORS);
  });

  it('変わっていない回は、値と activity を残して成功を書く', async () => {
    await activities.applyRefresh('zenn', insertsOnly([item(1)]), {
      fetchedAt: T1,
      reason: '前の理由',
      validators: VALIDATORS,
    });

    await activities.recordNotModified('zenn', T2);

    expect(await readFetchResult(env.DB, 'zenn')).toEqual({
      fetched_at: T2,
      is_ok: 1,
      reason: null,
      last_succeeded_at: T2,
    });
    expect(await activities.readValidators('zenn')).toEqual(VALIDATORS);
    expect(await readActivityRows(env.DB, 'zenn')).toHaveLength(1);
  });
});

/**
 * 取得元で消えたかを確かめた日時（T048、research.md の R6、migrations/0015）
 */
describe('確かめた日時', () => {
  it('確かめた行に取得の日時を書き、読み戻せる。ほかの取得元の行には書かない', async () => {
    const id = await insertActivity(env.DB, {
      source: 'zenn',
      url: 'https://zenn.dev/ksyunnnn/articles/fake-old',
      publishedAt: PUBLISHED,
    });
    const otherId = await insertActivity(env.DB, {
      source: 'medium',
      externalId: 'https://medium.com/p/fake',
      url: 'https://medium.com/fake',
      publishedAt: PUBLISHED,
    });

    await activities.applyRefresh(
      'zenn',
      {
        inserts: [],
        updates: [],
        deletes: [],
        goneChecked: [
          { id, goneStreak: 1 },
          { id: otherId, goneStreak: 1 },
        ],
        skippedWithoutDate: 0,
      },
      { fetchedAt: T1, reason: null, validators: null },
    );

    expect((await activities.listStoredForRefresh('zenn'))[0]?.goneCheckedAt).toBe(T1);
    expect((await activities.listStoredForRefresh('medium'))[0]?.goneCheckedAt).toBeNull();
  });
});

/**
 * 404 が続いた回数（T048b、migrations/0019 の `consecutive_gone_count`、research.md の R6）。
 * 回数は取得の回をまたいで D1 に持ち越す
 */
describe('404 が続いた回数', () => {
  const OLD_URL = 'https://zenn.dev/ksyunnnn/articles/fake-old';
  const GONE_LIMITS = { ...LIMITS, maxGoneChecks: 1 };

  const readCount = async (id: number) =>
    (await env.DB.prepare(
      'SELECT consecutive_gone_count AS n, updated_at FROM activity WHERE id = ?',
    )
      .bind(id)
      .first<{ n: number; updated_at: string }>()) ?? null;

  const run = (listed: string[], answer: GoneCheck, at: string) =>
    refreshSources(
      {
        activities,
        fetchListing: async () => ({
          items: listed.map((url) => ({ url, title: '作り物', publishedAt: PUBLISHED })),
          isComplete: false,
        }),
        goneCheckOf: () => async () => answer,
      },
      ['zenn'],
      at,
      GONE_LIMITS,
    );

  const insertOld = () =>
    insertActivity(env.DB, {
      source: 'zenn',
      url: OLD_URL,
      title: '作り物',
      publishedAt: PUBLISHED,
    });

  it('1 回目の 404 で回数を 1 にして残し、次の回の 404 で消す（回数を持ち越す）', async () => {
    const id = await insertOld();
    const before = await readCount(id);

    await run([], 'gone', T1);
    const after = await readCount(id);
    expect(after?.n).toBe(1);
    expect(after?.updated_at).toBe(before?.updated_at);
    expect((await activities.listStoredForRefresh('zenn'))[0]?.goneStreak).toBe(1);

    await run([], 'gone', T2);
    expect(await readCount(id)).toBeNull();
  });

  it('間に 2xx か判定できない応答が挟まったら、回数を 0 に戻し、次の 404 では消さない', async () => {
    const id = await insertOld();

    await run([], 'gone', T1);
    await run([], 'unknown', T2);
    expect((await readCount(id))?.n).toBe(0);

    await run([], 'gone', '2026-11-03T00:00:00.000Z');
    expect((await readCount(id))?.n).toBe(1);
  });

  it('一覧に載った行の回数を 0 に戻す', async () => {
    const id = await insertOld();
    await run([], 'gone', T1);

    await run([OLD_URL], 'gone', T2);

    expect((await readCount(id))?.n).toBe(0);
  });
});

/**
 * URL を指名した・手で入力した外部の activity の保存（`ExternalActivityRepository`、FR-005・FR-011・
 * FR-012・FR-022・FR-033、plan.md の U12）
 */
describe('ExternalActivityRepository', () => {
  const owned = createD1ExternalActivityRepository(env.DB);
  const SPOTIFY_URL = 'https://open.spotify.com/playlist/0000000000000000000fake';
  const content = (overrides = {}) => ({
    url: SPOTIFY_URL,
    title: '作り物のプレイリスト',
    publishedAt: '2024-03-01T00:00:00.000Z',
    imageUrl: null,
    ...overrides,
  });

  it('登録した行を uid で開け、日付は入れた日付のまま読める', async () => {
    const result = await owned.register('spotify', content());
    if (!result.ok) throw new Error('登録できなかった');

    expect(result.uid).toMatch(/^[0-9a-f]{32}$/);
    const id = await owned.findIdByUid(result.uid);
    expect(id).toBe(result.id);
    expect(await owned.findForEdit(result.id)).toEqual({
      id: result.id,
      uid: result.uid,
      source: 'spotify',
      url: SPOTIFY_URL,
      title: '作り物のプレイリスト',
      publishedOn: '2024-03-01',
    });
  });

  it('同じ取得元の同じ URL は url-taken（FR-005）', async () => {
    await owned.register('unlisted', content({ url: 'https://example.com/fake' }));

    expect(await owned.register('unlisted', content({ url: 'https://example.com/fake' }))).toEqual({
      ok: false,
      reason: 'url-taken',
    });
  });

  it('一覧を取る取得元の行と life event の行は、一覧に出さず、開けず、書き換えず、消さない（FR-022）', async () => {
    const listId = await insertActivity(env.DB, {
      source: 'zenn',
      url: 'https://zenn.dev/ksyunnnn/articles/fake',
      title: '作り物の記事',
      publishedAt: PUBLISHED,
    });
    const lifeEventId = await insertLifeEvent(env.DB);
    const before = await env.DB.prepare('SELECT * FROM activity ORDER BY id').all();
    const uids = await env.DB.prepare('SELECT uid FROM activity').all<{ uid: string }>();

    expect(await owned.list()).toEqual([]);
    for (const { uid } of uids.results) expect(await owned.findIdByUid(uid)).toBeNull();
    for (const id of [listId, lifeEventId]) {
      expect(await owned.findForEdit(id)).toBeNull();
      expect(await owned.edit(id, { publishedAt: T1 })).toEqual({ ok: false, reason: 'not-found' });
      expect(await owned.delete(id)).toBe(false);
    }
    expect(await env.DB.prepare('SELECT * FROM activity ORDER BY id').all()).toEqual(before);
  });

  it('一覧を取る取得元への登録は投げ、行を書かない', async () => {
    await expect(owned.register('zenn' as never, content())).rejects.toThrow();
    expect(await readActivityRows(env.DB, 'zenn')).toEqual([]);
  });

  it('編集は渡した列だけを書き換え、削除は行を消す（FR-033）', async () => {
    const result = await owned.register(
      'codepen',
      content({ url: 'https://codepen.io/fake/pen/a' }),
    );
    if (!result.ok) throw new Error('登録できなかった');

    expect(await owned.edit(result.id, { publishedAt: '2024-05-05T00:00:00.000Z' })).toEqual({
      ok: true,
    });
    expect(await owned.findForEdit(result.id)).toMatchObject({
      url: 'https://codepen.io/fake/pen/a',
      title: '作り物のプレイリスト',
      publishedOn: '2024-05-05',
    });

    expect(await owned.delete(result.id)).toBe(true);
    expect(await owned.findForEdit(result.id)).toBeNull();
  });

  it('公開日の無い項目で取り直しても、オーナーが登録した日付を変えない（FR-012）', async () => {
    const result = await owned.register('spotify', content());
    if (!result.ok) throw new Error('登録できなかった');
    const stored = await activities.listStoredForRefresh('spotify');

    const plan = planRefresh(stored, [{ url: SPOTIFY_URL, title: '題を変えたプレイリスト' }]);
    await activities.applyRefresh(
      'spotify',
      { ...plan, deletes: [] },
      { fetchedAt: T1, reason: null, validators: null },
    );

    expect(plan.updates).toEqual([{ id: result.id, changes: { title: '題を変えたプレイリスト' } }]);
    expect(await owned.findForEdit(result.id)).toMatchObject({
      title: '題を変えたプレイリスト',
      publishedOn: '2024-03-01',
    });
  });
});
