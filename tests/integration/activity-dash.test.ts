import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';

/**
 * URL を指名した・手で入力した外部の activity の管理画面と書き込みの操作
 * （specs/004-external-activity/spec.md の FR-022・FR-031・FR-033、contracts/dash.md）。値はすべて作り物。
 * 登録は手で入力する取得元（CodePen）で送り、外へ要求を出さない
 */

const SEEDED = { url: 'https://codepen.io/fake/pen/seeded', title: '作り物のペン' };
const LISTED = {
  url: 'https://zenn.dev/ksyunnnn/articles/fake-listed',
  title: '作り物の一覧の記事',
};

const INPUT = {
  source: 'codepen',
  url: 'https://codepen.io/fake/pen/input',
  title: '結合の検査で入力したペン',
  publishedOn: '2021-05-05',
};

let ctx: TestServer;
let editUid: string;
let listedUid: string;

const ABSENT_UID = '0'.repeat(32);
const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

const readActivityRows = async () =>
  (await ctx.db.prepare('SELECT * FROM activity ORDER BY id').all()).results;
const readFetchResults = async () =>
  (await ctx.db.prepare('SELECT * FROM fetch_result ORDER BY source').all()).results;

const readFormOf = async (path: string) => {
  const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
  expect(res.status).toBe(200);
  return readActionFields(await res.text());
};

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const insert = (source: string, url: string, title: string) =>
        db
          .prepare(
            "INSERT INTO activity (source, url, title, published_at) VALUES (?, ?, ?, '2020-04-01T00:00:00.000Z') RETURNING uid",
          )
          .bind(source, url, title)
          .first<{ uid: string }>();
      editUid = (await insert('codepen', SEEDED.url, SEEDED.title))!.uid;
      listedUid = (await insert('zenn', LISTED.url, LISTED.title))!.uid;
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('オーナーの画面', () => {
  it('一覧は登録した activity を出し、一覧を取る取得元の activity を出さない（FR-022）', async () => {
    const res = await ctx.server.fetch('/dash/activities', { headers: await authorHeaders() });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(SEEDED.title);
    expect(text).not.toContain(LISTED.title);
  });

  it.each(['/dash/activities/new', '/dash/activities/{uid}', '/dash/activities/{uid}/delete'])(
    'オーナーの %s は 200',
    async (template) => {
      const res = await ctx.server.fetch(template.replace('{uid}', editUid), {
        headers: await authorHeaders(),
      });
      expect(res.status).toBe(200);
    },
  );

  it.each([ABSENT_UID, '{listed}'])(
    '無い uid・一覧を取る取得元の uid（%s）の編集の画面は 404',
    async (uid) => {
      const res = await ctx.server.fetch(`/dash/activities/${uid.replace('{listed}', listedUid)}`, {
        headers: await authorHeaders(),
      });
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain(LISTED.title);
    },
  );

  it.each([
    '/dash/activities',
    '/dash/activities/new',
    '/dash/activities/{uid}',
    '/dash/activities/{uid}/delete',
  ])('オーナーの JWT がない %s は 403 で、画面の中身を返さない', async (template) => {
    const res = await ctx.server.fetch(template.replace('{uid}', editUid));
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toContain(SEEDED.title);
    expect(text).not.toContain('<form');
  });
});

describe('オーナーの JWT がない書き込み（FR-031、constitution I）', () => {
  /** Server Action は経路に縛られない。`/dash` の外の経路へ送り、Server Action が自分で拒むことを確かめる */
  const OUTSIDE_DASH = '/';

  const send = async (
    how: 'submit' | 'call',
    formPath: string,
    values: Record<string, string | number>,
    headers: Record<string, string>,
  ) => {
    const fields = await readFormOf(formPath);
    if (how === 'submit') {
      const { body, contentType } = await encodeForm(fields, values);
      return ctx.server.fetch(OUTSIDE_DASH, {
        method: 'POST',
        body,
        headers: { ...headers, 'content-type': contentType },
        redirect: 'manual',
      });
    }
    const request = await encodeActionCall(fields, values);
    return ctx.server.fetch(OUTSIDE_DASH, {
      method: 'POST',
      body: request.body,
      headers: { ...headers, ...request.headers },
      redirect: 'manual',
    });
  };

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    const unchanged = async (write: () => Promise<{ text: () => Promise<string> }>) => {
      const before = { activity: await readActivityRows(), fetch: await readFetchResults() };
      const res = await write();
      const text = await res.text();
      expect({ activity: await readActivityRows(), fetch: await readFetchResults() }).toEqual(
        before,
      );
      return text;
    };

    it('登録は activity と fetch_result を変えず、入力した値を返さない', async () => {
      const text = await unchanged(() => send(how, '/dash/activities/new', INPUT, {}));
      expect(text).not.toContain(INPUT.title);
    });

    it('書き換えは activity と fetch_result を変えない', async () => {
      await unchanged(() =>
        send(how, `/dash/activities/${editUid}`, { ...INPUT, activityUid: editUid }, {}),
      );
    });

    it('削除は activity と fetch_result を変えない', async () => {
      await unchanged(() =>
        send(how, `/dash/activities/${editUid}/delete`, { activityUid: editUid }, {}),
      );
    });

    it('対照: オーナーの JWT があれば、同じ形の登録が書く', async () => {
      const before = (await readActivityRows()).length;
      const res = await send(
        how,
        '/dash/activities/new',
        { ...INPUT, url: `${INPUT.url}-${how}` },
        await authorHeaders(),
      );
      await res.arrayBuffer();
      expect((await readActivityRows()).length).toBe(before + 1);
    });
  });

  it('オーナーでも、一覧を取る取得元の activity は消さない（FR-022）', async () => {
    const before = await readActivityRows();
    const fields = await readFormOf(`/dash/activities/${editUid}/delete`);
    const { body, contentType } = await encodeForm(fields, { activityUid: listedUid });
    const res = await ctx.server.fetch(OUTSIDE_DASH, {
      method: 'POST',
      body,
      headers: { ...(await authorHeaders()), 'content-type': contentType },
      redirect: 'manual',
    });
    await res.arrayBuffer();
    expect(await readActivityRows()).toEqual(before);
  });
});
