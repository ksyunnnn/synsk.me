import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { readRows, sendForm } from './support/send';
import {
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
  insertSkill,
  uidOf,
} from '../support/career-and-project-rows';

/**
 * 職歴・学歴・スキルの書き込みと、学歴を訪問者に出さないこと（specs/001-career-and-project/
 * spec.md の FR-037・FR-040・SC-005）。
 */

const PROJECT_SLUG = 'fake-education-check';
const SCHOOL = '訪問者に出さない作り物大学';

let ctx: TestServer;
let careerUid: string;
let educationUid: string;
let skillUid: string;

const CAREER_INPUT = {
  organizationName: '結合の検査の作り物の組織',
  organizationNameMasked: '結合の検査の会社',
  role: '結合の検査で入力した肩書',
  isMasked: '1',
  startedOn: '2020-04-01',
  endedOn: '',
  description: '',
  url: '',
};
const EDUCATION_INPUT = {
  school: '結合の検査で入力した学校',
  department: '',
  startedOn: '2014-04-01',
  endedOn: '2018-03-31',
  remarks: '',
};
const SKILL_INPUT = { name: '結合の検査で入力したスキル', overrideYears: '', overrideMonths: '' };

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const organizationId = await insertOrganization(db);
      careerUid = await uidOf(db, 'career', await insertCareer(db, { organizationId }));
      educationUid = await uidOf(db, 'education', await insertEducation(db, { school: SCHOOL }));
      skillUid = await uidOf(db, 'skill', await insertSkill(db, { name: 'Go' }));
      await insertProject(db, {
        organizationId,
        slug: PROJECT_SLUG,
        isMasked: false,
        status: 'published',
      });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('学歴は、職務経歴書の外の訪問者への応答に含まれない（FR-037・SC-005）', () => {
  it.each([
    ['HTML', {}, ''],
    ['RSC', { rsc: '1' }, '?_rsc'],
  ])('%s', async (_, headers, query) => {
    for (const path of ['/', `/projects/${PROJECT_SLUG}`, '/dash/educations']) {
      const res = await ctx.server.fetch(`${path}${query}`, { headers, redirect: 'manual' });
      expect(await res.text(), path).not.toContain(SCHOOL);
    }
  });
});

describe('作り手の JWT がない書き込み（FR-040）', () => {
  const OUTSIDE_DASH = `/projects/${PROJECT_SLUG}`;

  const cases = () =>
    [
      ['職歴の登録', 'career', '/dash/careers/new', CAREER_INPUT],
      [
        '職歴の編集',
        'career',
        `/dash/careers/${careerUid}`,
        { ...CAREER_INPUT, careerUid, openedUpdatedAt: '' },
      ],
      ['職歴の削除', 'career', `/dash/careers/${careerUid}/delete`, { careerUid }],
      ['学歴の登録', 'education', '/dash/educations/new', EDUCATION_INPUT],
      [
        '学歴の編集',
        'education',
        `/dash/educations/${educationUid}`,
        { ...EDUCATION_INPUT, educationUid },
      ],
      ['学歴の削除', 'education', `/dash/educations/${educationUid}/delete`, { educationUid }],
      ['スキルの登録', 'skill', '/dash/skills/new', SKILL_INPUT],
      ['スキルの編集', 'skill', `/dash/skills/${skillUid}`, { ...SKILL_INPUT, skillUid }],
      ['スキルの削除', 'skill', `/dash/skills/${skillUid}/delete`, { skillUid }],
    ] as const;

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    it('どの書き込みも D1 を変えない', async () => {
      for (const [name, table, formPath, values] of cases()) {
        const before = await readRows(ctx, table);
        const res = await sendForm(ctx, {
          how,
          formPath,
          to: OUTSIDE_DASH,
          values,
          asAuthor: false,
        });
        await res.arrayBuffer();
        expect(await readRows(ctx, table), name).toEqual(before);
      }
    });

    it('対照: 作り手の JWT があれば、同じ形の登録が書く', async () => {
      for (const [name, table, formPath, values] of cases().filter(([n]) => n.endsWith('登録'))) {
        const before = (await readRows(ctx, table)).length;
        const unique = `（対照 ${how}）`;
        const sent = {
          ...values,
          ...('role' in values ? { role: values.role + unique } : {}),
          ...('school' in values ? { school: values.school + unique } : {}),
          ...('name' in values ? { name: values.name + unique } : {}),
        };
        const res = await sendForm(ctx, { how, formPath, values: sent, asAuthor: true });
        await res.arrayBuffer();
        expect((await readRows(ctx, table)).length, name).toBe(before + 1);
      }
    });
  });
});

it.each([
  '/dash/careers',
  '/dash/careers/new',
  '/dash/educations',
  '/dash/educations/new',
  '/dash/skills',
  '/dash/skills/new',
])('作り手の JWT がない %s は 403', async (path) => {
  const res = await ctx.server.fetch(path);
  expect(res.status).toBe(403);
  await res.arrayBuffer();
});

/** 形は uid だが、どの行も持たない値 */
const MISSING_UID = '0'.repeat(32);

it.each([
  `/dash/careers/${MISSING_UID}`,
  `/dash/educations/${MISSING_UID}`,
  `/dash/skills/${MISSING_UID}`,
  // 主キーでは開けない（ADR-0048）
  '/dash/careers/1',
  '/dash/educations/1',
  '/dash/skills/1',
])('作り手の、無い uid の %s は 404', async (path) => {
  const res = await ctx.server.fetch(path, {
    headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
  });
  expect(res.status).toBe(404);
  await res.arrayBuffer();
});
