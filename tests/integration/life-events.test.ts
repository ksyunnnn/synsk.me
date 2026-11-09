import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';

/**
 * life event の個別のページと、life event の書き込みの操作（specs/004-external-activity/spec.md の
 * FR-026・FR-031・FR-034・SC-007、contracts/visitor-life-event.md・contracts/dash.md）。
 * 値はすべて作り物
 */

const SEEDED = { slug: 'fake-life-event', title: '作り物の出来事', description: '作り物の説明' };

/** オーナーが入力する値。応答と D1 に残ったかを確かめるため、ほかの値と重ならないものにする */
const INPUT = {
  title: '結合の検査で入力した出来事',
  description: '',
  happenedOn: '2021-05-05',
  slug: '',
};

let ctx: TestServer;
let editUid: string;

const ABSENT_UID = '0'.repeat(32);
const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

const readActivityRows = async () =>
  (await ctx.db.prepare('SELECT * FROM activity ORDER BY id').all()).results;

const readFormOf = async (path: string) => {
  const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
  expect(res.status).toBe(200);
  return readActionFields(await res.text());
};

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const row = await db
        .prepare(
          "INSERT INTO activity (source, slug, title, description, happened_on) VALUES ('life_event', ?, ?, ?, '2020-04-01') RETURNING uid",
        )
        .bind(SEEDED.slug, SEEDED.title, SEEDED.description)
        .first<{ uid: string }>();
      editUid = row!.uid;
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('/life-events/{slug}（SC-007）', () => {
  it('ある識別子は 200 で、DTO の値を出し、主キーと uid を出さない', async () => {
    const res = await ctx.server.fetch(`/life-events/${SEEDED.slug}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(SEEDED.title);
    expect(text).toContain(SEEDED.description);
    expect(text).toContain('2020-04-01');
    expect(text).not.toContain(editUid);
  });

  it('無い識別子は 404', async () => {
    const res = await ctx.server.fetch('/life-events/no-such-life-event');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(SEEDED.title);
  });

  it('外部の activity は個別のページを持たない（FR-034）', async () => {
    await ctx.db
      .prepare(
        "INSERT INTO activity (source, url, title, published_at) VALUES ('zenn', 'https://zenn.dev/fake', '作り物の外部の記事', '2025-01-01T00:00:00.000Z')",
      )
      .run();
    const res = await ctx.server.fetch('/life-events/fake');
    expect(res.status).toBe(404);
  });
});

describe('オーナーの画面', () => {
  it.each(['/dash/life-events', '/dash/life-events/new', '/dash/life-events/{uid}'])(
    'オーナーの %s は 200',
    async (template) => {
      const res = await ctx.server.fetch(template.replace('{uid}', editUid), {
        headers: await authorHeaders(),
      });
      expect(res.status).toBe(200);
    },
  );

  it('無い uid の編集の画面は 404', async () => {
    const res = await ctx.server.fetch(`/dash/life-events/${ABSENT_UID}`, {
      headers: await authorHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it.each([
    '/dash/life-events',
    '/dash/life-events/new',
    '/dash/life-events/{uid}',
    '/dash/life-events/{uid}/delete',
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
  const OUTSIDE_DASH = `/life-events/${SEEDED.slug}`;

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
    it('作るのは D1 を変えず、入力した値を返さない', async () => {
      const before = await readActivityRows();
      const res = await send(how, '/dash/life-events/new', INPUT, {});
      expect(await res.text()).not.toContain(INPUT.title);
      expect(await readActivityRows()).toEqual(before);
    });

    it('書き換えは D1 を変えない', async () => {
      const before = await readActivityRows();
      const res = await send(
        how,
        `/dash/life-events/${editUid}`,
        { ...INPUT, lifeEventUid: editUid },
        {},
      );
      await res.arrayBuffer();
      expect(await readActivityRows()).toEqual(before);
    });

    it('削除は D1 を変えない', async () => {
      const before = await readActivityRows();
      const res = await send(
        how,
        `/dash/life-events/${editUid}/delete`,
        { lifeEventUid: editUid },
        {},
      );
      await res.arrayBuffer();
      expect(await readActivityRows()).toEqual(before);
    });

    it('対照: オーナーの JWT があれば、同じ形の作成が書く', async () => {
      const before = (await readActivityRows()).length;
      const res = await send(
        how,
        '/dash/life-events/new',
        { ...INPUT, title: `${INPUT.title}（対照 ${how}）` },
        await authorHeaders(),
      );
      await res.arrayBuffer();
      expect((await readActivityRows()).length).toBe(before + 1);
    });
  });
});
