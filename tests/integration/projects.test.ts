import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';
import { insertOrganization, insertProject } from '../support/career-and-project-rows';

/**
 * 実績の個別のページと、実績の書き込みの操作（specs/001-career-and-project/spec.md の
 * FR-014・FR-040・SC-002、contracts/visitor-project.md・contracts/dash.md）。
 * 秘匿化した実績の応答の中身は project-masking.test.ts が持つ。
 */

const UNMASKED = { slug: 'fake-personal-app', title: '作り物の個人開発のアプリ' };

/** 作り手が入力する値。応答と D1 に残ったかを確かめるため、ほかの値と重ならないものにする */
const INPUT = {
  organizationName: '結合の検査で入力した組織',
  organizationNameMasked: '結合の検査の会社',
  kind: 'talk',
  title: '結合の検査で入力した題',
  titleMasked: '結合の検査の秘匿化した題',
  isMasked: '1',
  startedOn: '2025-01-01',
  endedOn: '',
  description: '',
  url: '',
};

let ctx: TestServer;
let editId: number;
const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

const countProjects = async () =>
  (await ctx.db.prepare('SELECT count(*) AS n FROM project').first<{ n: number }>())?.n ?? 0;

const readProjectRows = async () =>
  (await ctx.db.prepare('SELECT * FROM project ORDER BY id').all()).results;

/** 作り手として画面を開き、フォームの操作を指す hidden の入力を取り出す */
const readFormOf = async (path: string) => {
  const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
  expect(res.status).toBe(200);
  return readActionFields(await res.text());
};

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const organizationId = await insertOrganization(db, { name: '作り物の個人' });
      editId = await insertProject(db, {
        organizationId,
        slug: UNMASKED.slug,
        title: UNMASKED.title,
        isMasked: false,
        status: 'published',
      });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('/projects/{slug}（SC-002）', () => {
  it('ある識別子は 200 で、実績を出す', async () => {
    const res = await ctx.server.fetch(`/projects/${UNMASKED.slug}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(UNMASKED.title);
  });

  it('無い識別子は 404', async () => {
    const res = await ctx.server.fetch('/projects/no-such-project');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(UNMASKED.title);
  });
});

describe('作り手の画面', () => {
  it.each(['/dash/projects', '/dash/projects/new'])('作り手の %s は 200', async (path) => {
    const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
    expect(res.status).toBe(200);
  });

  it('無い id の編集の画面は 404', async () => {
    const res = await ctx.server.fetch('/dash/projects/999', { headers: await authorHeaders() });
    expect(res.status).toBe(404);
  });

  it.each(['/dash/projects', '/dash/projects/new', '/dash/projects/1', '/dash/projects/1/delete'])(
    '作り手の JWT がない %s は 403 で、画面の中身を返さない',
    async (path) => {
      const res = await ctx.server.fetch(path);
      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).not.toContain(UNMASKED.title);
      expect(text).not.toContain('<form');
    },
  );
});

describe('作り手の JWT がない書き込み（FR-040）', () => {
  /**
   * Server Action は経路に縛られない。`/dash` の外の経路へ送り、`src/proxy.ts` の 403 に
   * 頼らずに、Server Action が自分で拒むことを確かめる
   */
  const OUTSIDE_DASH = `/projects/${UNMASKED.slug}`;

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
    it('登録は D1 を変えず、入力した値を返さない', async () => {
      const before = await readProjectRows();
      const res = await send(how, '/dash/projects/new', INPUT, {});
      const text = await res.text();
      expect(text).not.toContain(INPUT.title);
      expect(await readProjectRows()).toEqual(before);
    });

    it('編集は D1 を変えない', async () => {
      const before = await readProjectRows();
      const res = await send(
        how,
        `/dash/projects/${editId}`,
        { ...INPUT, isMasked: '0', slug: UNMASKED.slug, projectId: editId, openedUpdatedAt: '' },
        {},
      );
      await res.arrayBuffer();
      expect(await readProjectRows()).toEqual(before);
    });

    it('削除は D1 を変えない', async () => {
      const before = await readProjectRows();
      const res = await send(how, `/dash/projects/${editId}/delete`, { projectId: editId }, {});
      await res.arrayBuffer();
      expect(await readProjectRows()).toEqual(before);
    });

    it('対照: 作り手の JWT があれば、同じ形の登録が書く', async () => {
      // 上の検査が、要求の形の誤りで書き込まずに通っていないことを確かめる
      const before = await countProjects();
      const res = await send(
        how,
        '/dash/projects/new',
        { ...INPUT, title: `${INPUT.title}（対照 ${how}）` },
        await authorHeaders(),
      );
      await res.arrayBuffer();
      expect(await countProjects()).toBe(before + 1);
    });
  });
});
