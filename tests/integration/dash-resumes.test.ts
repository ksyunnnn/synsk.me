import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { readRows } from './support/send';
import { sendNthForm } from './support/resume';
import { isNoStore } from '../../scripts/lib/verify-deploy.mjs';
import { insertCareer, insertOrganization, uidOf } from '../support/career-and-project-rows';
import {
  insertResume,
  insertResumeCareer,
  insertResumeEducation,
  insertResumeProject,
  type InsertedResume,
} from '../support/resume-rows';

/**
 * 職務経歴書の管理画面はオーナーだけのもの（specs/002-resume/spec.md の FR-033、contracts/dash.md の
 * 検査）。JWT のない GET は 403 で `no-store`、JWT のない Server Action は D1 を変えない。
 * Server Action は経路に縛られないため、`/dash` の外へ送って、Server Action が自分でオーナーを
 * 確かめることを確かめる
 */

let ctx: TestServer;
let resume: InsertedResume;
let careerId: number;
/** 写した行の uid。管理画面の URL とフォームは uid で行を指す */
let rows: { career: string; project: string; education: string };

const TABLES = [
  'resume',
  'resume_career',
  'resume_project',
  'resume_education',
  'resume_project_skill',
  'resume_skill_override',
];

const snapshot = async () =>
  Object.fromEntries(
    await Promise.all(
      TABLES.map(async (table) => [
        table,
        (await ctx.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,
      ]),
    ),
  );

const updatedAtOf = async (id: number) =>
  (await ctx.db.prepare('SELECT updated_at FROM resume WHERE id = ?').bind(id).first<{
    updated_at: string;
  }>())!.updated_at;

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      careerId = await insertCareer(db, { organizationId: await insertOrganization(db) });
    },
  });
  resume = await insertResume(ctx.db, { status: 'published' });
  rows = {
    career: await uidOf(
      ctx.db,
      'resume_career',
      await insertResumeCareer(ctx.db, { resumeId: resume.id }),
    ),
    project: await uidOf(
      ctx.db,
      'resume_project',
      await insertResumeProject(ctx.db, { resumeId: resume.id, skills: ['Go'] }),
    ),
    education: await uidOf(
      ctx.db,
      'resume_education',
      await insertResumeEducation(ctx.db, { resumeId: resume.id }),
    ),
  };
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('JWT のない GET は 403 で、どのキャッシュにも残さない', () => {
  const paths = () => [
    '/dash/resumes',
    '/dash/resumes/new',
    `/dash/resumes/${resume.uid}`,
    `/dash/resumes/${resume.uid}/preview`,
    `/dash/resumes/${resume.uid}/skills`,
    `/dash/resumes/${resume.uid}/delete`,
    `/dash/resumes/${resume.uid}/careers/${rows.career}`,
    `/dash/resumes/${resume.uid}/projects/${rows.project}`,
    `/dash/resumes/${resume.uid}/educations/${rows.education}`,
    `/dash/resumes/${resume.uid}/careers/new`,
    `/dash/resumes/${resume.uid}/projects/new`,
    `/dash/resumes/${resume.uid}/educations/new`,
  ];

  it('どの画面も', async () => {
    for (const path of paths()) {
      const res = await ctx.server.fetch(path, { redirect: 'manual' });
      const text = await res.text();
      expect(res.status, path).toBe(403);
      expect(isNoStore(res.headers), path).toBe(true);
      expect(text, path).not.toContain('写した作り物');
    }
  });

  it('対照: オーナーなら 200', async () => {
    for (const path of paths()) {
      const res = await ctx.server.fetch(path, {
        headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
      });
      await res.arrayBuffer();
      expect(res.status, path).toBe(200);
    }
  });

  it('オーナーでも、無い行の画面は 404', async () => {
    for (const path of [
      `/dash/resumes/${'0'.repeat(32)}`,
      `/dash/resumes/${'0'.repeat(32)}/careers/new`,
      // 主キーでは開けない（ADR-0048）
      `/dash/resumes/${resume.id}`,
      `/dash/resumes/${resume.id}/careers/new`,
      `/dash/resumes/${resume.uid}/careers/${'0'.repeat(32)}`,
      // 別の種類の行の uid では開けない
      `/dash/resumes/${resume.uid}/projects/${rows.career}`,
    ]) {
      const res = await ctx.server.fetch(path, {
        headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
      });
      await res.arrayBuffer();
      expect(res.status, path).toBe(404);
    }
  });
});

describe('JWT のない Server Action は D1 を変えない（FR-033）', () => {
  const outside = () => `/resume/${resume.slug}`;
  const common = async () => ({
    resumeUid: resume.uid,
    openedUpdatedAt: await updatedAtOf(resume.id),
  });

  const cases = async (): Promise<
    [string, string, Record<string, string | number> | [string, string | number][]][]
  > => [
    [
      'createResume',
      '/dash/resumes/new',
      [
        ['title', '書いてはいけない職務経歴書'],
        ['audience', 'limited'],
        ['expires', ''],
        ['careerIds', careerId],
      ],
    ],
    [
      'editResumeCareer',
      `/dash/resumes/${resume.uid}/careers/${rows.career}`,
      {
        ...(await common()),
        rowUid: rows.career,
        organizationName: '書き換えた組織名',
        role: '書き換えた肩書',
        startedOn: '2020-04-01',
        endedOn: '',
        description: '',
        url: '',
      },
    ],
    [
      'editResumeProject',
      `/dash/resumes/${resume.uid}/projects/${rows.project}`,
      {
        ...(await common()),
        rowUid: rows.project,
        organizationName: '書き換えた組織名',
        kind: 'talk',
        title: '書き換えた題',
        startedOn: '2020-04-01',
        endedOn: '',
        skills: '',
        description: '',
        url: '',
      },
    ],
    [
      'editResumeEducation',
      `/dash/resumes/${resume.uid}/educations/${rows.education}`,
      {
        ...(await common()),
        rowUid: rows.education,
        school: '書き換えた学校',
        department: '',
        startedOn: '2014-04-01',
        endedOn: '',
        remarks: '',
      },
    ],
    [
      'editResumeSkillOverrides',
      `/dash/resumes/${resume.uid}/skills`,
      { ...(await common()), overrideName: 'Go', overrideYears: '9', overrideMonths: '0' },
    ],
    [
      'addResumeRows',
      `/dash/resumes/${resume.uid}/careers/new`,
      { ...(await common()), rowKind: 'careers', careerIds: careerId },
    ],
    ['deleteResume', `/dash/resumes/${resume.uid}/delete`, { resumeUid: resume.uid }],
  ];

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    it('どの書き込みも', async () => {
      for (const [name, formPath, values] of await cases()) {
        if (how === 'call' && Array.isArray(values)) continue;
        const before = await snapshot();
        const res = await sendNthForm(ctx, {
          how,
          formPath,
          to: outside(),
          values,
          asAuthor: false,
        });
        await res.arrayBuffer();
        expect(await snapshot(), name).toEqual(before);
      }
    });
  });

  it('対照: オーナーの JWT があれば、同じ形の作成が書く', async () => {
    const before = (await readRows(ctx, 'resume')).length;
    const [, formPath, values] = (await cases())[0];
    const res = await sendNthForm(ctx, { how: 'submit', formPath, values, asAuthor: true });
    await res.arrayBuffer();
    expect((await readRows(ctx, 'resume')).length).toBe(before + 1);
  });
});

describe('作ったあとに足す（FR-041）', () => {
  it('オーナーが選んだ職歴を、元の値で写して足し、設定の画面へ 303 で移す', async () => {
    const added = await insertResume(ctx.db);
    const formPath = `/dash/resumes/${added.uid}/careers/new`;
    const res = await sendNthForm(ctx, {
      how: 'submit',
      formPath,
      values: {
        resumeUid: added.uid,
        openedUpdatedAt: await updatedAtOf(added.id),
        rowKind: 'careers',
        careerIds: careerId,
      },
      asAuthor: true,
    });
    await res.arrayBuffer();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(`/dash/resumes/${added.uid}?saved=1`);
    const copied = await ctx.db
      .prepare('SELECT career_id, organization_name FROM resume_career WHERE resume_id = ?')
      .bind(added.id)
      .all();
    expect(copied.results).toEqual([{ career_id: careerId, organization_name: '作り物株式会社' }]);

    // 写した職歴は、足す画面の選択肢に出ない
    const page = await ctx.server.fetch(formPath, {
      headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
    });
    const html = await page.text();
    expect(html).not.toContain(`value="${careerId}"`);
    expect(html).toContain('足せるものはありません');
  });
});
