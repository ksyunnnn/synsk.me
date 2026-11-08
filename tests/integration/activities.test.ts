import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { readRows, sendForm } from './support/send';
import { uidOf } from '../support/career-and-project-rows';
import { insertExternalActivity, insertLifeEvent } from '../support/activity-rows';

/**
 * life event の個別のページと、外部の activity・life event の管理画面と書き込みの操作
 * （specs/004-external-activity/spec.md の FR-031・FR-034・SC-007、contracts/dash.md・
 * contracts/visitor-life-event.md）。値はすべて作り物
 */

const LIFE_EVENT = {
  slug: 'fake-life-event',
  title: '作り物の出来事',
  description: '作り物の説明の一段落目\n\n作り物の説明の二段落目',
  happenedOn: '2020-04-01',
};
const MANUAL = { url: 'https://example.com/fake-manual', title: '作り物の手で入れた記事' };
const LISTED = {
  url: 'https://zenn.dev/ksyunnnn/articles/fake-listed',
  title: '作り物の Zenn の記事',
};
const FETCH_REASON = '作り物の取得の結果の理由';

/** 形は uid だが、どの行も持たない値 */
const ABSENT_UID = '0'.repeat(32);

let ctx: TestServer;
let lifeEventUid: string;
let manualUid: string;
let listedUid: string;

const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      lifeEventUid = await uidOf(db, 'activity', await insertLifeEvent(db, LIFE_EVENT));
      manualUid = await uidOf(
        db,
        'activity',
        await insertExternalActivity(db, { source: 'unlisted', ...MANUAL }),
      );
      listedUid = await uidOf(
        db,
        'activity',
        await insertExternalActivity(db, { source: 'zenn_article', ...LISTED }),
      );
      await db
        .prepare(
          "INSERT INTO fetch_result (source, fetched_at, is_ok, reason) VALUES ('zenn_article', '2026-11-09T00:00:00.000Z', 0, ?)",
        )
        .bind(FETCH_REASON)
        .run();
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('/life-events/{slug}（FR-034・SC-007）', () => {
  it('ある識別子は 200 で、題・起きた日・説明を出す', async () => {
    const res = await ctx.server.fetch(`/life-events/${LIFE_EVENT.slug}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(`<title>${LIFE_EVENT.title} | synsk.me</title>`);
    expect(text).toContain(LIFE_EVENT.happenedOn);
    expect(text).toContain('作り物の説明の二段落目');
    // 管理画面の識別子を訪問者に出さない
    expect(text).not.toContain(lifeEventUid);
  });

  it('無い識別子は 404', async () => {
    const res = await ctx.server.fetch('/life-events/no-such-event');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(LIFE_EVENT.title);
  });
});

describe('オーナーの画面', () => {
  const paths = () => [
    '/dash/activities',
    '/dash/activities/new',
    `/dash/activities/${manualUid}`,
    `/dash/activities/${manualUid}/delete`,
    '/dash/life-events',
    '/dash/life-events/new',
    `/dash/life-events/${lifeEventUid}`,
    `/dash/life-events/${lifeEventUid}/delete`,
  ];

  it('オーナーには 200 を返す', async () => {
    for (const path of paths()) {
      const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
      expect(res.status, path).toBe(200);
      await res.arrayBuffer();
    }
  });

  it('オーナーの JWT が無ければ 403 で、no-store を持ち、中身を返さない', async () => {
    for (const path of paths()) {
      const res = await ctx.server.fetch(path);
      expect(res.status, path).toBe(403);
      expect(res.headers.get('cache-control'), path).toBe('no-store, must-revalidate');
      const text = await res.text();
      expect(text, path).not.toContain(LIFE_EVENT.title);
      expect(text, path).not.toContain(MANUAL.title);
    }
  });

  it('無い uid は 404。life event の uid は外部の activity の画面で開けない', async () => {
    for (const path of [
      `/dash/activities/${ABSENT_UID}`,
      `/dash/life-events/${ABSENT_UID}`,
      `/dash/activities/${lifeEventUid}`,
    ]) {
      const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
      expect(res.status, path).toBe(404);
      await res.arrayBuffer();
    }
  });

  it('取得の結果を出す（research.md の R13）', async () => {
    const res = await ctx.server.fetch('/dash/activities', { headers: await authorHeaders() });
    const text = await res.text();
    expect(text).toContain(FETCH_REASON);
    expect(text).toContain(LISTED.title);
  });

  it('一覧を取る activity は、書き換えと削除のフォームを持たない（FR-022）', async () => {
    for (const path of [`/dash/activities/${listedUid}`, `/dash/activities/${listedUid}/delete`]) {
      const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
      expect(res.status, path).toBe(200);
      expect(await res.text(), path).not.toContain('<form');
    }
  });
});

describe('オーナーの JWT が無い書き込み（FR-031）', () => {
  /**
   * Server Action は経路に縛られない。`/dash` の外の経路へ送り、`src/proxy.ts` の 403 に
   * 頼らずに、Server Action が自分で拒むことを確かめる
   */
  const OUTSIDE_DASH = `/life-events/${LIFE_EVENT.slug}`;

  const newLifeEvent = {
    title: '結合の検査で入力した出来事',
    description: '',
    happenedOn: '2021-01-01',
  };
  const newActivity = {
    source: 'unlisted',
    url: 'https://example.com/fake-integration',
    title: '結合の検査で入力した記事',
    publishedOn: '2024-05-01',
  };

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    const send = (formPath: string, values: Record<string, string>, asAuthor = false) =>
      sendForm(ctx, { how, formPath, to: OUTSIDE_DASH, values, asAuthor });

    it('life event の作成・書き換え・削除は D1 を変えない', async () => {
      const before = await readRows(ctx, 'activity');
      for (const res of [
        await send('/dash/life-events/new', newLifeEvent),
        await send(`/dash/life-events/${lifeEventUid}`, {
          ...newLifeEvent,
          slug: 'rewritten',
          lifeEventUid,
        }),
        await send(`/dash/life-events/${lifeEventUid}/delete`, { lifeEventUid }),
      ]) {
        expect(await res.text()).not.toContain(newLifeEvent.title);
      }
      expect(await readRows(ctx, 'activity')).toEqual(before);
    });

    it('外部の activity の登録・書き換え・削除は D1 を変えない', async () => {
      const before = await readRows(ctx, 'activity');
      for (const res of [
        await send('/dash/activities/new', newActivity),
        await send(`/dash/activities/${manualUid}`, { ...newActivity, activityUid: manualUid }),
        await send(`/dash/activities/${manualUid}/delete`, { activityUid: manualUid }),
      ]) {
        await res.arrayBuffer();
      }
      expect(await readRows(ctx, 'activity')).toEqual(before);
    });

    it('対照: オーナーの JWT があれば、同じ形の作成と登録が書く', async () => {
      const before = (await readRows(ctx, 'activity')).length;
      await (
        await send(
          '/dash/life-events/new',
          { ...newLifeEvent, title: `${newLifeEvent.title}（対照 ${how}）` },
          true,
        )
      ).arrayBuffer();
      await (
        await send(
          '/dash/activities/new',
          { ...newActivity, url: `${newActivity.url}-${how}` },
          true,
        )
      ).arrayBuffer();
      expect((await readRows(ctx, 'activity')).length).toBe(before + 2);
    });
  });
});
