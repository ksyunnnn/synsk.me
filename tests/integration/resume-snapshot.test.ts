import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { sendForm } from './support/send';
import { findLimitedUrl, parseLimitedUrl, sendNthForm } from './support/resume';
import {
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
  uidOf,
} from '../support/career-and-project-rows';

/**
 * 元を直しても消しても、作った職務経歴書の中身は変わらない（specs/002-resume/spec.md の
 * User Story 3、FR-007・FR-025・FR-028・SC-001）。オーナーとして作ってから元を直し、限定公開用の
 * ページの応答を HTML と RSC の両方で調べる。値はすべて作り物
 */

const ORIGINAL = {
  organizationName: '作ったときの作り物株式会社',
  title: '作ったときの作り物の題',
  role: '作ったときの肩書',
  school: '作ったときの作り物大学',
  skill: '作ったときのスキル',
};

let ctx: TestServer;
let ids: {
  organization: number;
  career: number;
  project: number;
  education: number;
  skill: number;
};
let url: ReturnType<typeof parseLimitedUrl>;

const asAuthor = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

const fetchPage = async (as: 'HTML' | 'RSC') => {
  const res = await ctx.server.fetch(as === 'RSC' ? `${url.path}?_rsc` : url.path, {
    headers: as === 'RSC' ? { rsc: '1' } : {},
  });
  return { status: res.status, text: await res.text() };
};

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const organization = await insertOrganization(db, { name: ORIGINAL.organizationName });
      const skill = await insertSkill(db, { name: ORIGINAL.skill, monthsOverride: 30 });
      const project = await insertProject(db, {
        organizationId: organization,
        title: ORIGINAL.title,
      });
      await linkProjectSkill(db, project, skill);
      ids = {
        organization,
        career: await insertCareer(db, { organizationId: organization, role: ORIGINAL.role }),
        project,
        education: await insertEducation(db, { school: ORIGINAL.school }),
        skill,
      };
    },
  });

  const created = await sendNthForm(ctx, {
    how: 'submit',
    formPath: '/dash/resumes/new',
    values: [
      ['title', '元を直す検査'],
      ['audience', 'limited'],
      ['expires', ''],
      ['careerIds', ids.career],
      ['projectIds', ids.project],
      ['educationIds', ids.education],
    ],
    asAuthor: true,
  });
  url = findLimitedUrl(await created.text());
  await ctx.db
    .prepare("UPDATE resume SET status = 'published' WHERE slug = ?")
    .bind(url.slug)
    .run();
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('元を直しても、作ったときの値で出る（User Story 3 の 1・2・4）', () => {
  beforeAll(async () => {
    await ctx.db.batch([
      ctx.db
        .prepare('UPDATE organization SET name = ? WHERE id = ?')
        .bind('直した組織名', ids.organization),
      ctx.db.prepare('UPDATE project SET title = ? WHERE id = ?').bind('直した題', ids.project),
      ctx.db.prepare('UPDATE career SET role = ? WHERE id = ?').bind('直した肩書', ids.career),
      ctx.db
        .prepare('UPDATE skill SET name = ?, months_override = ? WHERE id = ?')
        .bind('直したスキル', 99, ids.skill),
    ]);
  });

  it.each(['HTML', 'RSC'] as const)('%s', async (as) => {
    const { status, text } = await fetchPage(as);
    expect(status).toBe(200);
    for (const value of Object.values(ORIGINAL)) expect(text).toContain(value);
    // 写した上書き（30 か月）で出し、元の新しい上書き（99 か月）を使わない
    expect(text).toContain('2 年 6 か月');
    for (const value of ['直した組織名', '直した題', '直した肩書', '直したスキル']) {
      expect(text).not.toContain(value);
    }
  });
});

describe('元を消しても、写した行が残る（User Story 3 の 3、Edge Cases）', () => {
  beforeAll(async () => {
    // 001 の削除の Server Action をオーナーとして呼ぶ。写した行の *_id を空にしてから消す
    const uids = {
      education: await uidOf(ctx.db, 'education', ids.education),
      project: await uidOf(ctx.db, 'project', ids.project),
      career: await uidOf(ctx.db, 'career', ids.career),
    };
    for (const [formPath, values] of [
      [`/dash/educations/${uids.education}/delete`, { educationUid: uids.education }],
      [`/dash/projects/${uids.project}/delete`, { projectUid: uids.project }],
      [`/dash/careers/${uids.career}/delete`, { careerUid: uids.career }],
    ] as const) {
      const res = await sendForm(ctx, { how: 'submit', formPath, values, asAuthor: true });
      await res.arrayBuffer();
      expect(res.status, formPath).toBe(303);
    }
    const left = await ctx.db
      .prepare('SELECT (SELECT count(*) FROM education) + (SELECT count(*) FROM project) AS n')
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it.each(['HTML', 'RSC'] as const)('%s', async (as) => {
    const { status, text } = await fetchPage(as);
    expect(status).toBe(200);
    for (const value of Object.values(ORIGINAL)) expect(text).toContain(value);
  });

  it('写した行の写し元の id は空になる', async () => {
    const row = await ctx.db
      .prepare(
        `SELECT (SELECT count(*) FROM resume_career WHERE career_id IS NOT NULL)
           + (SELECT count(*) FROM resume_project WHERE project_id IS NOT NULL)
           + (SELECT count(*) FROM resume_education WHERE education_id IS NOT NULL) AS n`,
      )
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});

it('オーナーの管理画面にも、作ったときの値が出る', async () => {
  const uid = (await ctx.db
    .prepare('SELECT uid FROM resume WHERE slug = ?')
    .bind(url.slug)
    .first<{ uid: string }>())!.uid;
  const res = await ctx.server.fetch(`/dash/resumes/${uid}`, { headers: await asAuthor() });
  const text = await res.text();
  expect(text).toContain(ORIGINAL.title);
  expect(text).toContain(ORIGINAL.school);
});
