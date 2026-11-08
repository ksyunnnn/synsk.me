import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeForm, readActionFields } from './support/form';
import {
  insertCareer,
  insertOrganization,
  insertProject,
  uidOf,
} from '../support/career-and-project-rows';

/**
 * サイトに載せない職歴・実績を、訪問者への応答に含めない（specs/001-career-and-project/spec.md の
 * FR-014・FR-044・FR-045・SC-006）。サイトに載せる実績は出す。切り替えた直後の要求から新しい
 * 状態で出す（FR-043）。
 *
 * 応答は、HTML と、画面の間を移るときの RSC のペイロードの両方を調べる。RSC の要求では、vinext は
 * 描画を始めてから 404 を決めるため、状態コードは 200 のまま本文に `NEXT_HTTP_ERROR_FALLBACK;404`
 * を含める（tests/integration/private-responses.test.ts と同じ）。値はすべて作り物
 */

/** サイトに載せない職歴・実績の値。どれも訪問者への応答に 0 件 */
const DRAFT = {
  organizationName: '載せない作り物の組織',
  organizationNameMasked: '載せない作り物の秘匿化した組織名',
  unmaskedTitle: '載せない作り物の実名のアプリ',
  maskedTitle: '載せない作り物の秘匿化する受託開発',
  maskedTitleMasked: '載せない作り物の秘匿化した題',
  description: '載せない作り物の本文',
  careerRole: '載せない作り物の肩書',
};

const DRAFT_UNMASKED_SLUG = 'fake-draft-unmasked';
const DRAFT_MASKED_SLUG = '3c2b1a09-1111-4222-8333-444455556666';

const PUBLISHED = {
  slug: 'fake-published-app',
  organizationName: '載せる作り物の個人',
  title: '載せる作り物のアプリ',
};

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

let ctx: TestServer;
let publishedId: number;

const fetchVisitor = async (path: string, as: typeof AS_HTML) => {
  const res = await ctx.server.fetch(`${path}${as.query}`, {
    headers: as.headers,
    redirect: 'manual',
  });
  return { status: res.status, text: await res.text() };
};

const expectNotFound = ({ status, text }: { status: number; text: string }, as: typeof AS_HTML) => {
  if (as === AS_RSC) expect(text).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
  else expect(status).toBe(404);
};

const expectNoDraftValues = (text: string) => {
  for (const [name, value] of Object.entries(DRAFT)) {
    expect(text, `${name} が応答に含まれる`).not.toContain(value);
  }
};

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const draftOrg = await insertOrganization(db, {
        name: DRAFT.organizationName,
        nameMasked: DRAFT.organizationNameMasked,
      });
      await insertProject(db, {
        organizationId: draftOrg,
        slug: DRAFT_UNMASKED_SLUG,
        title: DRAFT.unmaskedTitle,
        description: DRAFT.description,
        isMasked: false,
        status: 'draft',
      });
      // サイトに載せるかを指定しない。列の既定で載せない（FR-044）
      await insertProject(db, {
        organizationId: draftOrg,
        slug: DRAFT_MASKED_SLUG,
        title: DRAFT.maskedTitle,
        titleMasked: DRAFT.maskedTitleMasked,
        description: DRAFT.description,
        isMasked: true,
      });
      await insertCareer(db, {
        organizationId: draftOrg,
        role: DRAFT.careerRole,
        description: DRAFT.description,
        isMasked: false,
      });

      const publishedOrg = await insertOrganization(db, {
        name: PUBLISHED.organizationName,
        nameMasked: '個人',
      });
      publishedId = await insertProject(db, {
        organizationId: publishedOrg,
        slug: PUBLISHED.slug,
        title: PUBLISHED.title,
        isMasked: false,
        status: 'published',
      });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
])('訪問者への応答（%s）', (_, as) => {
  it.each([DRAFT_UNMASKED_SLUG, DRAFT_MASKED_SLUG])(
    'サイトに載せない実績 %s は、無い識別子と同じく 404 で、値を 0 件含む（FR-014・FR-045）',
    async (slug) => {
      const res = await fetchVisitor(`/projects/${slug}`, as);
      expectNotFound(res, as);
      expectNoDraftValues(res.text);
    },
  );

  it('サイトに載せる実績は出す', async () => {
    const { status, text } = await fetchVisitor(`/projects/${PUBLISHED.slug}`, as);
    expect(status).toBe(200);
    expect(text).toContain(PUBLISHED.title);
    expect(text).toContain(PUBLISHED.organizationName);
  });

  it.each(['/', `/projects/${PUBLISHED.slug}`])(
    '訪問者が到達するほかの経路 %s も、サイトに載せない職歴・実績の値を含まない（SC-006）',
    async (path) => {
      expectNoDraftValues((await fetchVisitor(path, as)).text);
    },
  );
});

// このファイルの最後に置く。サイトに載せる実績を、載せない実績に変える
it('サイトに載せないに切り替えると、直後の要求から 404 になる（FR-043）', async () => {
  const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });
  const uid = await uidOf(ctx.db, 'project', publishedId);
  const path = `/dash/projects/${uid}`;
  const page = await ctx.server.fetch(path, { headers: await authorHeaders() });
  expect(page.status).toBe(200);
  const row = await ctx.db
    .prepare(
      `SELECT p.*, o.name AS organization_name, o.name_masked AS organization_name_masked
       FROM project p JOIN organization o ON o.id = p.organization_id WHERE p.id = ?`,
    )
    .bind(publishedId)
    .first<Record<string, string | null>>();
  const { body, contentType } = await encodeForm(readActionFields(await page.text()), {
    projectUid: uid,
    openedUpdatedAt: row?.updated_at ?? '',
    organizationName: row?.organization_name ?? '',
    organizationNameMasked: row?.organization_name_masked ?? '',
    kind: row?.kind ?? '',
    title: row?.title ?? '',
    titleMasked: row?.title_masked ?? '',
    isMasked: '0',
    status: 'draft',
    startedOn: row?.started_on ?? '',
    endedOn: row?.ended_on ?? '',
    description: row?.description ?? '',
    url: row?.url ?? '',
    slug: row?.slug ?? '',
  });
  const res = await ctx.server.fetch(path, {
    method: 'POST',
    body,
    headers: { ...(await authorHeaders()), 'content-type': contentType },
    redirect: 'manual',
  });
  await res.arrayBuffer();
  expect(res.status).toBe(303);

  const after = await fetchVisitor(`/projects/${PUBLISHED.slug}`, AS_HTML);
  expect(after.status).toBe(404);
  expect(after.text).not.toContain(PUBLISHED.title);
});
