import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { readRows } from './support/send';
import { sendNthForm } from './support/resume';
import { isNoStore } from '../../scripts/lib/verify-deploy.mjs';
import { insertCareer, insertOrganization } from '../support/career-and-project-rows';
import {
  insertResume,
  insertResumeCareer,
  insertResumeEducation,
  insertResumeProject,
  type InsertedResume,
} from '../support/resume-rows';

/**
 * 職務経歴書の管理画面は作り手だけのもの（specs/002-resume/spec.md の FR-033、contracts/dash.md の
 * 検査）。JWT のない GET は 403 で `no-store`、JWT のない Server Action は D1 を変えない。
 * Server Action は経路に縛られないため、`/dash` の外へ送って、Server Action が自分で作り手を
 * 確かめることを確かめる
 */

let ctx: TestServer;
let resume: InsertedResume;
let careerId: number;
let rows: { career: number; project: number; education: number };

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
    career: await insertResumeCareer(ctx.db, { resumeId: resume.id }),
    project: await insertResumeProject(ctx.db, { resumeId: resume.id, skills: ['Go'] }),
    education: await insertResumeEducation(ctx.db, { resumeId: resume.id }),
  };
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('JWT のない GET は 403 で、どのキャッシュにも残さない', () => {
  const paths = () => [
    '/dash/resumes',
    '/dash/resumes/new',
    `/dash/resumes/${resume.id}`,
    `/dash/resumes/${resume.id}/preview`,
    `/dash/resumes/${resume.id}/skills`,
    `/dash/resumes/${resume.id}/delete`,
    `/dash/resumes/${resume.id}/careers/${rows.career}`,
    `/dash/resumes/${resume.id}/projects/${rows.project}`,
    `/dash/resumes/${resume.id}/educations/${rows.education}`,
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

  it('対照: 作り手なら 200', async () => {
    for (const path of paths()) {
      const res = await ctx.server.fetch(path, {
        headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
      });
      await res.arrayBuffer();
      expect(res.status, path).toBe(200);
    }
  });

  it('作り手でも、無い行の画面は 404', async () => {
    for (const path of [
      '/dash/resumes/999999',
      `/dash/resumes/${resume.id}/careers/999999`,
      `/dash/resumes/${resume.id}/projects/${rows.career}9999`,
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
  const outside = () => `/resume/${resume.slug}/${resume.key}`;
  const common = async () => ({
    resumeId: resume.id,
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
      `/dash/resumes/${resume.id}/careers/${rows.career}`,
      {
        ...(await common()),
        rowId: rows.career,
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
      `/dash/resumes/${resume.id}/projects/${rows.project}`,
      {
        ...(await common()),
        rowId: rows.project,
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
      `/dash/resumes/${resume.id}/educations/${rows.education}`,
      {
        ...(await common()),
        rowId: rows.education,
        school: '書き換えた学校',
        department: '',
        startedOn: '2014-04-01',
        endedOn: '',
        remarks: '',
      },
    ],
    [
      'editResumeSkillOverrides',
      `/dash/resumes/${resume.id}/skills`,
      { ...(await common()), overrideName: 'Go', overrideYears: '9', overrideMonths: '0' },
    ],
    ['deleteResume', `/dash/resumes/${resume.id}/delete`, { resumeId: resume.id }],
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

  it('対照: 作り手の JWT があれば、同じ形の作成が書く', async () => {
    const before = (await readRows(ctx, 'resume')).length;
    const [, formPath, values] = (await cases())[0];
    const res = await sendNthForm(ctx, { how: 'submit', formPath, values, asAuthor: true });
    await res.arrayBuffer();
    expect((await readRows(ctx, 'resume')).length).toBe(before + 1);
  });
});
