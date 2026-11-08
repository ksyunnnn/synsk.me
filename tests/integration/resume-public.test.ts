import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { PUBLIC_SETTINGS_FORMS, sendNthForm } from './support/resume';
import {
  insertCareer,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';

/**
 * 公開用の職務経歴書（specs/002-resume/spec.md の User Story 5、SC-002・FR-016〜FR-019・FR-022・
 * FR-029・FR-031・FR-039、tasks.md の T064・T065）。
 *
 * 応答は HTML と RSC のペイロードの両方を調べる（tests/integration/resume-limited.test.ts と同じ）。
 * 値はすべて作り物
 */

/** 秘匿化した写し元の実際の値。公開用の応答に 0 件（SC-002） */
const HIDDEN = {
  organizationName: '伏せる作り物株式会社',
  title: '伏せる作り物の受託開発',
  description: '伏せる作り物の本文',
  url: 'https://hidden.example.com/secret',
  careerDescription: '伏せる作り物の職歴の本文',
};

/** 秘匿化した写し元の、出してよい値（FR-018） */
const MASKED = {
  organizationName: '伏せた作り物の会社',
  title: '伏せた作り物の題',
};

/** 秘匿化しない写し元の値。実際の値で出す */
const OPEN = {
  organizationName: '見せる作り物の個人',
  title: '見せる作り物の登壇',
  description: '見せる作り物の本文',
};

/** サイトに載せない写し元の値。公開用に写さない（FR-016） */
const OFF_SITE = { title: '載せない作り物の実績' };

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

let ctx: TestServer;
let sources: { maskedCareer: number; masked: number; open: number; offSite: number };

const fetchVisitor = async (path: string, as: typeof AS_HTML) => {
  const res = await ctx.server.fetch(`${path}${as.query}`, {
    headers: as.headers,
    redirect: 'manual',
  });
  return { status: res.status, text: await res.text() };
};

const expectNoHidden = (text: string) => {
  for (const [name, value] of Object.entries(HIDDEN)) {
    expect(text, `${name} が応答に含まれる`).not.toContain(value);
  }
};

const updatedAtOf = async (id: number) =>
  (await ctx.db.prepare('SELECT updated_at FROM resume WHERE id = ?').bind(id).first<{
    updated_at: string;
  }>())!.updated_at;

const resumeRowOf = async (title: string) =>
  ctx.db
    .prepare('SELECT id, uid, slug, audience, status FROM resume WHERE title = ?')
    .bind(title)
    .first<{ id: number; uid: string; slug: string; audience: string; status: string }>();

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const hiddenOrg = await insertOrganization(db, {
        name: HIDDEN.organizationName,
        nameMasked: MASKED.organizationName,
      });
      const openOrg = await insertOrganization(db, {
        name: OPEN.organizationName,
        nameMasked: '個人',
      });
      const skill = await insertSkill(db, { name: 'TypeScript' });
      const masked = await insertProject(db, {
        organizationId: hiddenOrg,
        title: HIDDEN.title,
        titleMasked: MASKED.title,
        description: HIDDEN.description,
        url: HIDDEN.url,
        isMasked: true,
        status: 'published',
      });
      await linkProjectSkill(db, masked, skill);
      sources = {
        maskedCareer: await insertCareer(db, {
          organizationId: hiddenOrg,
          description: HIDDEN.careerDescription,
          url: HIDDEN.url,
          isMasked: true,
          status: 'published',
        }),
        masked,
        open: await insertProject(db, {
          organizationId: openOrg,
          title: OPEN.title,
          description: OPEN.description,
          isMasked: false,
          status: 'published',
        }),
        offSite: await insertProject(db, {
          organizationId: openOrg,
          title: OFF_SITE.title,
          isMasked: false,
          status: 'draft',
        }),
      };
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('公開用を作り、訪問者に見せる（User Story 5 の 1〜5）', () => {
  let resume: NonNullable<Awaited<ReturnType<typeof resumeRowOf>>>;

  it('オーナーが公開用を作ると、設定の画面へ移る', async () => {
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: '/dash/resumes/new',
      values: [
        ['title', '作り物の公開用'],
        ['audience', 'public'],
        ['careerIds', sources.maskedCareer],
        ['projectIds', sources.masked],
        ['projectIds', sources.open],
        // JavaScript なしでは選択肢から外せない。選んでいても写さない（FR-016）
        ['projectIds', sources.offSite],
      ],
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    const row = await resumeRowOf('作り物の公開用');
    expect(row).toMatchObject({ audience: 'public', status: 'draft' });
    resume = row!;
    expect(res.headers.get('location')).toContain(`/dash/resumes/${resume.uid}`);
  });

  it('D1 に、秘匿化した写し元の実際の値とサイトに載せない行を写さない（FR-016・SC-007）', async () => {
    const read = async (table: string) =>
      (await ctx.db.prepare(`SELECT * FROM ${table} WHERE resume_id = ?`).bind(resume.id).all())
        .results;
    const rows = JSON.stringify([
      ...(await read('resume_project')),
      ...(await read('resume_career')),
    ]);
    expectNoHidden(rows);
    expect(rows).not.toContain(OFF_SITE.title);
    expect(rows).toContain(MASKED.title);
  });

  it('非公開のうちは 404（FR-022）', async () => {
    for (const as of [AS_HTML, AS_RSC]) {
      const res = await fetchVisitor(`/resume/${resume.slug}`, as);
      if (as === AS_RSC) expect(res.text).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
      else expect(res.status).toBe(404);
      expect(res.text).not.toContain(MASKED.title);
      expectNoHidden(res.text);
    }
  });

  it('公開すると、秘匿化した行は秘匿化した値で、秘匿化しない行は実際の値で出る（SC-002）', async () => {
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: `/dash/resumes/${resume.uid}`,
      formIndex: PUBLIC_SETTINGS_FORMS.status,
      values: {
        resumeUid: resume.uid,
        openedUpdatedAt: await updatedAtOf(resume.id),
        status: 'published',
      },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    for (const as of [AS_HTML, AS_RSC]) {
      const page = await fetchVisitor(`/resume/${resume.slug}`, as);
      expect(page.status).toBe(200);
      expectNoHidden(page.text);
      expect(page.text).toContain(MASKED.organizationName);
      expect(page.text).toContain(MASKED.title);
      expect(page.text).toContain('非公開');
      expect(page.text).toContain('TypeScript');
      for (const value of Object.values(OPEN)) expect(page.text).toContain(value);
      expect(page.text).not.toContain(OFF_SITE.title);
    }
  });

  it('<title> と OGP に中身を出さない', async () => {
    const { text } = await fetchVisitor(`/resume/${resume.slug}`, AS_HTML);
    const head = text.slice(0, text.indexOf('</head>'));
    expectNoHidden(head);
    expect(head).not.toContain(MASKED.title);
    expect(head).toMatch(/<title>職務経歴書 \| synsk\.me<\/title>/);
  });

  it('「PDF で保存」のボタンを持ち、印刷するページにも隠す値が無い（User Story 5 の 5、FR-029）', async () => {
    // PDF は同じページをブラウザが印刷して作る（research.md の R11）
    const { text } = await fetchVisitor(`/resume/${resume.slug}`, AS_HTML);
    expect(text).toContain('PDF で保存');
    expectNoHidden(text);
  });

  it('オーナーが職務経歴書の中で秘匿化した行に本文を書き足しても出ない（FR-031）', async () => {
    await ctx.db
      .prepare(
        `UPDATE resume_project SET description = ?, url = ?
         WHERE resume_id = ? AND is_masked = 1`,
      )
      .bind(HIDDEN.description, HIDDEN.url, resume.id)
      .run();
    for (const as of [AS_HTML, AS_RSC]) {
      const page = await fetchVisitor(`/resume/${resume.slug}`, as);
      expect(page.status).toBe(200);
      expectNoHidden(page.text);
    }
  });

  it('識別子を読みやすい値に書き換えると、新しい URL で読め、古い URL は 404（FR-039）', async () => {
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: `/dash/resumes/${resume.uid}`,
      formIndex: PUBLIC_SETTINGS_FORMS.settings,
      values: {
        resumeUid: resume.uid,
        openedUpdatedAt: await updatedAtOf(resume.id),
        title: '作り物の公開用',
        slug: 'resume',
      },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    expect((await fetchVisitor('/resume/resume', AS_HTML)).status).toBe(200);
    expect((await fetchVisitor(`/resume/${resume.slug}`, AS_HTML)).status).toBe(404);
  });

  it('2 つ目の公開用は保存の前に拒む（FR-019）', async () => {
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath: '/dash/resumes/new',
      values: [
        ['title', '2 つ目の作り物の公開用'],
        ['audience', 'public'],
      ],
      asAuthor: true,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('公開用は 1 つだけ作れます');
    expect(await resumeRowOf('2 つ目の作り物の公開用')).toBeNull();
  });
});
