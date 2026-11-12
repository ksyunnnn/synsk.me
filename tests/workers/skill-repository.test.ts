import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectContent } from '@/features/project/domain/project';
import { createD1ProjectRepository } from '@/features/project/server/d1-project-repository';
import { createD1SkillRepository } from '@/features/skill/server/d1-skill-repository';
import type { CalendarDate } from '@/shared/domain/period';
import {
  deleteCareerAndProjectRows,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';

/**
 * スキルの D1 の実装と、実績へのスキルのつなぎ（specs/001-career-and-project/spec.md の
 * FR-031・FR-032・FR-034、research.md の R7・R8）。
 */

const skills = createD1SkillRepository(env.DB);
const projects = createD1ProjectRepository(env.DB);

const OPENED_AT = '2026-11-01T00:00:00.000Z';
const NOW = '2026-11-04T00:00:00.000Z';

const projectContent = (skillIds: number[]): ProjectContent & { slug: string } => ({
  organizationName: '作り物株式会社',
  organizationNameMasked: 'ある会社',
  kind: 'develop',
  title: '作り物の受託開発',
  titleMasked: '業務システムの開発',
  isMasked: true,
  status: 'draft',
  period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
  description: null,
  url: null,
  skillIds,
  slug: 'skill-linked',
});

const linkedSkillIds = async (projectId: number) =>
  (
    await env.DB.prepare(
      'SELECT skill_id FROM project_skill WHERE project_id = ? ORDER BY skill_id',
    )
      .bind(projectId)
      .all<{ skill_id: number }>()
  ).results.map((row) => row.skill_id);

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteCareerAndProjectRows(env.DB);
});

describe('register と edit', () => {
  it('上書きの月数を保存する（FR-034）', async () => {
    const result = await skills.register({ name: 'TypeScript', monthsOverride: 71 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.uid).toMatch(/^[0-9a-f]{32}$/);
    expect(await skills.findById(result.id)).toEqual({
      id: result.id,
      uid: result.uid,
      name: 'TypeScript',
      monthsOverride: 71,
    });
  });

  it('登録したスキルの uid から id を引き、無い uid なら null（管理画面の URL、migrations/0011）', async () => {
    const result = await skills.register({ name: 'Go', monthsOverride: null });
    if (!result.ok) throw new Error(result.reason);
    expect(await skills.findIdByUid(result.uid)).toBe(result.id);
    expect(await skills.findIdByUid('0'.repeat(32))).toBeNull();
  });

  it('大文字と小文字だけ違う名前のスキルを登録しない（FR-031）', async () => {
    await insertSkill(env.DB, { name: 'TypeScript' });
    expect(await skills.register({ name: 'typescript', monthsOverride: null })).toEqual({
      ok: false,
      reason: 'name-taken',
    });
  });

  it('大文字と小文字だけ違う名前に直さない（FR-031）', async () => {
    await insertSkill(env.DB, { name: 'TypeScript' });
    const id = await insertSkill(env.DB, { name: 'Go' });
    expect(await skills.edit(id, { name: 'TYPESCRIPT', monthsOverride: null })).toEqual({
      ok: false,
      reason: 'name-taken',
    });
  });

  it('上書きを外せる', async () => {
    const id = await insertSkill(env.DB, { monthsOverride: 12 });
    expect(await skills.edit(id, { name: 'TypeScript', monthsOverride: null })).toEqual({
      ok: true,
    });
    expect((await skills.findById(id))?.monthsOverride).toBeNull();
  });
});

describe('delete', () => {
  it('実績とのつながりを先に消してから消す（R8）', async () => {
    const id = await insertSkill(env.DB);
    const projectId = await insertProject(env.DB, {
      organizationId: await insertOrganization(env.DB),
    });
    await linkProjectSkill(env.DB, projectId, id);
    expect(await skills.delete(id)).toEqual({ ok: true });
    expect(await skills.findById(id)).toBeNull();
    expect(await linkedSkillIds(projectId)).toEqual([]);
  });
});

describe('listWithPeriods', () => {
  it('スキルごとに、つないだ実績の期間を返す', async () => {
    const organizationId = await insertOrganization(env.DB);
    const ts = await insertSkill(env.DB, { name: 'TypeScript' });
    await insertSkill(env.DB, { name: 'Go' });
    const p1 = await insertProject(env.DB, {
      organizationId,
      startedOn: '2020-04-01',
      endedOn: '2021-03-31',
    });
    await linkProjectSkill(env.DB, p1, ts);
    expect(await skills.listWithPeriods('all')).toEqual([
      {
        id: expect.any(Number),
        uid: expect.stringMatching(/^[0-9a-f]{32}$/),
        name: 'Go',
        monthsOverride: null,
        periods: [],
      },
      {
        id: ts,
        uid: expect.stringMatching(/^[0-9a-f]{32}$/),
        name: 'TypeScript',
        monthsOverride: null,
        periods: [{ startedOn: '2020-04-01', endedOn: '2021-03-31' }],
      },
    ]);
  });

  it('published は、サイトに載せる実績の期間だけを返し、all はすべての実績の期間を返す（FR-033）', async () => {
    const organizationId = await insertOrganization(env.DB);
    const ts = await insertSkill(env.DB, { name: 'TypeScript' });
    const published = await insertProject(env.DB, {
      organizationId,
      startedOn: '2020-04-01',
      endedOn: '2021-03-31',
      status: 'published',
    });
    const draft = await insertProject(env.DB, {
      organizationId,
      startedOn: '2022-04-01',
      endedOn: '2023-03-31',
    });
    await linkProjectSkill(env.DB, published, ts);
    await linkProjectSkill(env.DB, draft, ts);

    const periodsOf = async (projects: 'all' | 'published') =>
      (await skills.listWithPeriods(projects)).find((skill) => skill.id === ts)?.periods;
    expect(await periodsOf('published')).toEqual([
      { startedOn: '2020-04-01', endedOn: '2021-03-31' },
    ]);
    expect(await periodsOf('all')).toEqual(
      expect.arrayContaining([
        { startedOn: '2020-04-01', endedOn: '2021-03-31' },
        { startedOn: '2022-04-01', endedOn: '2023-03-31' },
      ]),
    );
  });
});

describe('実績へのつなぎ（FR-032）', () => {
  it('登録でスキルを 0 個以上つなぐ', async () => {
    const a = await insertSkill(env.DB, { name: 'A' });
    const b = await insertSkill(env.DB, { name: 'B' });
    const result = await projects.register(projectContent([a, b]));
    if (!result.ok) throw new Error(result.reason);
    expect(await linkedSkillIds(result.id)).toEqual([a, b]);

    const none = await projects.register({ ...projectContent([]), slug: 'no-skills' });
    if (!none.ok) throw new Error(none.reason);
    expect(await linkedSkillIds(none.id)).toEqual([]);
  });

  it('編集でつながりを入れ直し、findForEdit が返す', async () => {
    const a = await insertSkill(env.DB, { name: 'A' });
    const b = await insertSkill(env.DB, { name: 'B' });
    const result = await projects.register(projectContent([a]));
    if (!result.ok) throw new Error(result.reason);
    await env.DB.prepare('UPDATE project SET updated_at = ? WHERE id = ?')
      .bind(OPENED_AT, result.id)
      .run();

    expect(
      await projects.edit(result.id, projectContent([b]), { openedUpdatedAt: OPENED_AT, now: NOW }),
    ).toEqual({ ok: true });
    expect((await projects.findForEdit(result.id))?.skillIds).toEqual([b]);
  });

  it('先に書き換えられていたら、つながりも変えない（R7）', async () => {
    const a = await insertSkill(env.DB, { name: 'A' });
    const b = await insertSkill(env.DB, { name: 'B' });
    const result = await projects.register(projectContent([a]));
    if (!result.ok) throw new Error(result.reason);
    await env.DB.prepare('UPDATE project SET updated_at = ? WHERE id = ?')
      .bind('2026-11-02T00:00:00.000Z', result.id)
      .run();

    expect(
      await projects.edit(result.id, projectContent([b]), { openedUpdatedAt: OPENED_AT, now: NOW }),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await linkedSkillIds(result.id)).toEqual([a]);
  });

  it('秘匿化した組織名が無く登録されなかった実績は、つながりも入れない', async () => {
    const a = await insertSkill(env.DB, { name: 'A' });
    await insertOrganization(env.DB, { name: '作り物株式会社', nameMasked: null });
    expect(
      await projects.register({ ...projectContent([a]), organizationNameMasked: null }),
    ).toEqual({ ok: false, reason: 'masked-name-required' });
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM project_skill').first<{ n: number }>())?.n,
    ).toBe(0);
  });
});
