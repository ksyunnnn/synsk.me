import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { readRows } from './support/send';
import {
  findLimitedUrl,
  LIMITED_SETTINGS_FORMS,
  parseLimitedUrl,
  sendNthForm,
} from './support/resume';
import {
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';
import {
  insertResume,
  insertResumeCareer,
  insertResumeProject,
  type InsertedResume,
} from '../support/resume-rows';

/**
 * 限定公開用の職務経歴書を訪問者に見せる条件と応答（specs/002-resume/spec.md の User Story 2、
 * SC-003・SC-004・SC-005、FR-010〜FR-015・FR-022・FR-023・FR-029・FR-033・FR-040）。
 *
 * 応答は、HTML と、画面の間を移るときの RSC のペイロードの両方を調べる。RSC の要求では、vinext は
 * 描画を始めてから 404 を決めるため、状態コードは 200 のまま本文に `NEXT_HTTP_ERROR_FALLBACK;404`
 * を含める（tests/integration/private-responses.test.ts と同じ）。値はすべて作り物
 */

/** 秘匿化した写し元の実際の値。限定公開用では出す（FR-010） */
const REAL = {
  organizationName: '限定公開で見せる作り物株式会社',
  title: '限定公開で見せる作り物の受託開発',
  description: '限定公開で見せる作り物の本文',
  school: '限定公開で見せる作り物大学',
};

/** 3 つの状態の職務経歴書が持つ値。中身を返さない応答に 0 件 */
const WITHHELD = {
  organizationName: '返さない作り物の組織',
  title: '返さない作り物の題',
  description: '返さない作り物の本文',
};

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

const LIMITED_HEADERS = {
  'cache-control': 'no-store, must-revalidate',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
};

let ctx: TestServer;
let sourceIds: { career: number; project: number; education: number };
const states: Record<'draft' | 'expired' | 'published', InsertedResume> = {} as never;

const fetchVisitor = async (path: string, as: typeof AS_HTML) => {
  const res = await ctx.server.fetch(`${path}${as.query}`, {
    headers: as.headers,
    redirect: 'manual',
  });
  return { status: res.status, headers: res.headers, text: await res.text() };
};

const expectNotFound = (res: { status: number; text: string }, as: typeof AS_HTML) => {
  if (as === AS_RSC) {
    expect(res.status).toBe(200);
    expect(res.text).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
  } else {
    expect(res.status).toBe(404);
  }
};

const expectLimitedHeaders = (headers: { get: (name: string) => string | null }) => {
  for (const [name, value] of Object.entries(LIMITED_HEADERS)) {
    expect(headers.get(name), name).toBe(value);
  }
};

const expectNoWithheld = (text: string) => {
  for (const [name, value] of Object.entries(WITHHELD)) {
    expect(text, `${name} が応答に含まれる`).not.toContain(value);
  }
};

const insertWithheldContent = async (resumeId: number) => {
  await insertResumeCareer(ctx.db, {
    resumeId,
    organizationName: WITHHELD.organizationName,
    description: WITHHELD.description,
  });
  await insertResumeProject(ctx.db, {
    resumeId,
    organizationName: WITHHELD.organizationName,
    title: WITHHELD.title,
    description: WITHHELD.description,
  });
};

const updatedAtOf = async (id: number) =>
  (await ctx.db.prepare('SELECT updated_at FROM resume WHERE id = ?').bind(id).first<{
    updated_at: string;
  }>())!.updated_at;

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const org = await insertOrganization(db, {
        name: REAL.organizationName,
        nameMasked: '秘匿化した作り物の会社',
      });
      const skill = await insertSkill(db, { name: 'TypeScript' });
      const project = await insertProject(db, {
        organizationId: org,
        title: REAL.title,
        titleMasked: '秘匿化した作り物の題',
        description: REAL.description,
        isMasked: true,
      });
      await linkProjectSkill(db, project, skill);
      sourceIds = {
        career: await insertCareer(db, { organizationId: org, isMasked: true }),
        project,
        education: await insertEducation(db, { school: REAL.school }),
      };
    },
  });
  states.draft = await insertResume(ctx.db, { status: 'draft' });
  states.expired = await insertResume(ctx.db, {
    status: 'published',
    expiresAt: '2020-01-01T00:00:00.000Z',
  });
  states.published = await insertResume(ctx.db, { status: 'published' });
  for (const resume of Object.values(states)) await insertWithheldContent(resume.id);
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('作って、訪問者に見せる（User Story 2 の 1、FR-010・FR-021）', () => {
  let url: ReturnType<typeof parseLimitedUrl>;
  let resumeId: number;
  let resumeUid: string;

  it('作り手が作ると、/resume/{uid} の URL を同じ画面に返す（FR-011・FR-012）', async () => {
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: '/dash/resumes/new',
      values: [
        ['title', '作り物の提出先'],
        ['audience', 'limited'],
        ['expires', ''],
        ['careerIds', sourceIds.career],
        ['projectIds', sourceIds.project],
        ['educationIds', sourceIds.education],
      ],
      asAuthor: true,
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    url = findLimitedUrl(html);
    expect(url.slug).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const row = await ctx.db
      .prepare('SELECT * FROM resume WHERE slug = ?')
      .bind(url.slug)
      .first<Record<string, unknown>>();
    expect(row).toMatchObject({ status: 'draft', audience: 'limited' });
    resumeId = row!.id as number;
    resumeUid = row!.uid as string;
  });

  it('下書きのうちは 404（FR-022）', async () => {
    const res = await fetchVisitor(url.path, AS_HTML);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain(REAL.title);
    expectLimitedHeaders(res.headers);
  });

  it('訪問者に見せる状態にすると、秘匿化した写し元の実際の値で出る', async () => {
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: `/dash/resumes/${resumeUid}`,
      formIndex: LIMITED_SETTINGS_FORMS.status,
      values: {
        resumeUid,
        openedUpdatedAt: await updatedAtOf(resumeId),
        status: 'published',
      },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    for (const as of [AS_HTML, AS_RSC]) {
      const page = await fetchVisitor(url.path, as);
      expect(page.status).toBe(200);
      for (const value of Object.values(REAL)) expect(page.text).toContain(value);
      expect(page.text).toContain('TypeScript');
      expectLimitedHeaders(page.headers);
    }
  });

  it('ページは「PDF で保存」のボタンを持つ（FR-029・FR-030、research.md の R11）', async () => {
    const { text } = await fetchVisitor(url.path, AS_HTML);
    expect(text).toContain('PDF で保存');
  });

  it('<title> と OGP に中身を出さない（ADR-0024）', async () => {
    const { text } = await fetchVisitor(url.path, AS_HTML);
    const head = text.slice(0, text.indexOf('</head>'));
    for (const value of Object.values(REAL)) expect(head).not.toContain(value);
    expect(head).toMatch(/<title>職務経歴書 \| synsk\.me<\/title>/);
  });
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
])('中身を返さない 3 つの状態（%s、SC-003）', (_, as) => {
  it('下書き', async () => {
    const res = await fetchVisitor(`/resume/${states.draft.slug}`, as);
    expectNotFound(res, as);
    expectNoWithheld(res.text);
    expectLimitedHeaders(res.headers);
  });

  it('期限切れ', async () => {
    const res = await fetchVisitor(`/resume/${states.expired.slug}`, as);
    expectNotFound(res, as);
    expectNoWithheld(res.text);
    expectLimitedHeaders(res.headers);
  });

  it('存在しない識別子（最後の 1 文字を変える）', async () => {
    const slug = states.published.slug;
    const wrong = slug.slice(0, -1) + (slug.endsWith('a') ? 'b' : 'a');
    const res = await fetchVisitor(`/resume/${wrong}`, as);
    expectNotFound(res, as);
    expectNoWithheld(res.text);
    expectLimitedHeaders(res.headers);
  });

  it('識別子の後ろに値を足した経路', async () => {
    // 経路が無く、描画を始める前に 404 になる
    const res = await fetchVisitor(`/resume/${states.published.slug}/extra`, as);
    expect(res.status === 404 || res.text.includes('NEXT_HTTP_ERROR_FALLBACK;404')).toBe(true);
    expectNoWithheld(res.text);
  });

  it('対照: 訪問者に見せる状態で期限が無ければ中身を返す', async () => {
    const res = await fetchVisitor(`/resume/${states.published.slug}`, as);
    expect(res.status).toBe(200);
    expect(res.text).toContain(WITHHELD.title);
    expectLimitedHeaders(res.headers);
  });
});

it('期限を過ぎた後に期限を延ばすと、同じ URL で読める（SC-004、FR-014）', async () => {
  const resume = await insertResume(ctx.db, {
    status: 'published',
    expiresAt: '2020-01-01T00:00:00.000Z',
  });
  await insertResumeProject(ctx.db, { resumeId: resume.id, title: '延ばした後に見える題' });
  const path = `/resume/${resume.slug}`;
  expect((await fetchVisitor(path, AS_HTML)).status).toBe(404);

  const res = await sendNthForm(ctx, {
    how: 'submit',
    formPath: `/dash/resumes/${resume.uid}`,
    formIndex: LIMITED_SETTINGS_FORMS.settings,
    values: {
      resumeUid: resume.uid,
      openedUpdatedAt: await updatedAtOf(resume.id),
      title: '作り物の職務経歴書',
      expires: '2999-12-31T23:59',
    },
    asAuthor: true,
  });
  expect(res.status).toBe(303);
  const page = await fetchVisitor(path, AS_HTML);
  expect(page.status).toBe(200);
  expect(page.text).toContain('延ばした後に見える題');
});

describe('作り手の JWT がない書き込みは D1 を変えない（FR-033）', () => {
  describe.each(['submit', 'call'] as const)('%s', (how) => {
    it.each([
      ['URL の出し直し', LIMITED_SETTINGS_FORMS.url, {}],
      ['状態の切り替え', LIMITED_SETTINGS_FORMS.status, { status: 'draft' }],
      ['設定', LIMITED_SETTINGS_FORMS.settings, { title: '書き換えた題', expires: '' }],
    ] as const)('%s', async (_, formIndex, values) => {
      const target = states.published;
      const before = await readRows(ctx, 'resume');
      const res = await sendNthForm(ctx, {
        how,
        formPath: `/dash/resumes/${target.uid}`,
        formIndex,
        to: `/resume/${target.slug}`,
        values: { resumeUid: target.uid, openedUpdatedAt: await updatedAtOf(target.id), ...values },
        asAuthor: false,
      });
      await res.arrayBuffer();
      expect(await readRows(ctx, 'resume')).toEqual(before);
    });
  });
});

describe('設定の画面の URL と出し直し（FR-040）', () => {
  it('設定の画面に URL を示し、公開中ならその URL で開ける', async () => {
    const resume = await insertResume(ctx.db, { status: 'published' });
    const page = await ctx.server.fetch(`/dash/resumes/${resume.uid}`, {
      headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(findLimitedUrl(html).slug).toBe(resume.slug);
    expect(html).toContain('URL を出し直す');
    expect((await fetchVisitor(`/resume/${resume.slug}`, AS_HTML)).status).toBe(200);
  });

  it('出し直すと識別子が新しい uid になり、古い URL は 404、新しい URL は 200', async () => {
    const resume = await insertResume(ctx.db, { status: 'published' });
    await insertResumeProject(ctx.db, { resumeId: resume.id, title: '出し直した後も見える題' });
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: `/dash/resumes/${resume.uid}`,
      formIndex: LIMITED_SETTINGS_FORMS.url,
      values: { resumeUid: resume.uid, openedUpdatedAt: await updatedAtOf(resume.id) },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(`/dash/resumes/${resume.uid}?regenerated=1`);
    const row = await ctx.db
      .prepare('SELECT slug FROM resume WHERE id = ?')
      .bind(resume.id)
      .first<{ slug: string }>();
    expect(row!.slug).not.toBe(resume.slug);
    expect(row!.slug).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const old = await fetchVisitor(`/resume/${resume.slug}`, AS_HTML);
    expect(old.status).toBe(404);
    expect(old.text).not.toContain('出し直した後も見える題');
    const fresh = await fetchVisitor(`/resume/${row!.slug}`, AS_HTML);
    expect(fresh.status).toBe(200);
    expect(fresh.text).toContain('出し直した後も見える題');
  });

  it('開いた後に書き換えられていたら出し直さない（FR-038）', async () => {
    const resume = await insertResume(ctx.db, { status: 'published' });
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: `/dash/resumes/${resume.uid}`,
      formIndex: LIMITED_SETTINGS_FORMS.url,
      values: { resumeUid: resume.uid, openedUpdatedAt: '2000-01-01T00:00:00.000Z' },
      asAuthor: true,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('URL は出し直していません');
    const row = await ctx.db
      .prepare('SELECT slug FROM resume WHERE id = ?')
      .bind(resume.id)
      .first<{ slug: string }>();
    expect(row!.slug).toBe(resume.slug);
  });
});
