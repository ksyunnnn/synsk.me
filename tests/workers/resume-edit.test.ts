import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ResumeCareerContent, ResumeProjectContent } from '@/features/resume/domain/resume';
import { createD1ResumeRepository } from '@/features/resume/server/d1-resume-repository';
import type { CalendarDate } from '@/shared/domain/period';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertOrganization,
  uidOf,
} from '../support/career-and-project-rows';
import {
  deleteResumeRows,
  insertResume,
  insertResumeCareer,
  insertResumeEducation,
  insertResumeProject,
  insertResumeSkillOverride,
  type InsertedResume,
} from '../support/resume-rows';

/**
 * 職務経歴書の中で写した値を直すことと、削除（specs/002-resume/spec.md の FR-031・FR-032・
 * FR-038、User Story 4 の 1・2、research.md の R8・R9）。値はすべて作り物
 */

const resumes = createD1ResumeRepository(env.DB);
const NOW = '2026-11-04T00:00:00.000Z';

let target: InsertedResume;
let other: InsertedResume;
let sourceCareerId: number;
let rows: { career: number; otherCareer: number; project: number; newerProject: number };

const updatedAtOf = async (id: number) =>
  (await env.DB.prepare('SELECT updated_at FROM resume WHERE id = ?').bind(id).first<{
    updated_at: string;
  }>())!.updated_at;

const times = async (id: number) => ({ openedUpdatedAt: await updatedAtOf(id), now: NOW });

const careerContent = (overrides: Partial<ResumeCareerContent> = {}): ResumeCareerContent => ({
  organizationName: '直した作り物の組織名',
  role: '写した作り物の肩書',
  period: { startedOn: '2020-04-01' as CalendarDate, endedOn: null },
  description: null,
  url: null,
  ...overrides,
});

const projectContent = (overrides: Partial<ResumeProjectContent> = {}): ResumeProjectContent => ({
  organizationName: '写した作り物株式会社',
  kind: 'application',
  title: '直した作り物の題',
  period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
  description: '直した本文',
  url: null,
  skills: ['Rust', 'Go'],
  ...overrides,
});

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteResumeRows(env.DB);
  await deleteCareerAndProjectRows(env.DB);
  const org = await insertOrganization(env.DB, { name: '元の作り物の組織名' });
  sourceCareerId = await insertCareer(env.DB, { organizationId: org });
  target = await insertResume(env.DB);
  other = await insertResume(env.DB);
  rows = {
    career: await insertResumeCareer(env.DB, {
      resumeId: target.id,
      careerId: sourceCareerId,
      organizationName: '元の作り物の組織名',
    }),
    otherCareer: await insertResumeCareer(env.DB, {
      resumeId: other.id,
      careerId: sourceCareerId,
      organizationName: '元の作り物の組織名',
    }),
    project: await insertResumeProject(env.DB, {
      resumeId: target.id,
      startedOn: '2021-04-01',
      title: '古い題',
      skills: ['TypeScript'],
    }),
    newerProject: await insertResumeProject(env.DB, {
      resumeId: target.id,
      startedOn: '2023-04-01',
      title: '新しい題',
    }),
  };
  await insertResumeEducation(env.DB, { resumeId: target.id });
  await insertResumeSkillOverride(env.DB, target.id, 'TypeScript', 30);
});

describe('写した行を直す（FR-031・FR-032）', () => {
  it('直した組織名はその職務経歴書にだけ効き、元の組織とほかの職務経歴書は変わらない', async () => {
    expect(
      await resumes.editCareer(target.id, rows.career, careerContent(), await times(target.id)),
    ).toEqual({ ok: true });
    expect((await resumes.readContent(target.id)).careers[0].organizationName).toBe(
      '直した作り物の組織名',
    );
    expect((await resumes.readContent(other.id)).careers[0].organizationName).toBe(
      '元の作り物の組織名',
    );
    const org = await env.DB.prepare('SELECT name FROM organization').first<{ name: string }>();
    expect(org?.name).toBe('元の作り物の組織名');
  });

  it('秘匿化していたかと写し元の id は変わらない', async () => {
    await resumes.editCareer(target.id, rows.career, careerContent(), await times(target.id));
    expect((await resumes.readContent(target.id)).careers[0]).toMatchObject({
      isMasked: true,
      careerId: sourceCareerId,
    });
  });

  it('写した実績の始まりの日を直すと、並びが変わる（User Story 4 の 2）', async () => {
    expect((await resumes.readContent(target.id)).projects.map((p) => p.title)).toEqual([
      '新しい題',
      '古い題',
    ]);
    await resumes.editProject(
      target.id,
      rows.project,
      projectContent({
        title: '古い題',
        period: { startedOn: '2025-01-01' as CalendarDate, endedOn: null },
      }),
      await times(target.id),
    );
    expect((await resumes.readContent(target.id)).projects.map((p) => p.title)).toEqual([
      '古い題',
      '新しい題',
    ]);
  });

  it('写した実績のスキルの名前を入れ直す', async () => {
    await resumes.editProject(target.id, rows.project, projectContent(), await times(target.id));
    const project = (await resumes.readContent(target.id)).projects.find(
      (p) => p.id === rows.project,
    );
    expect(project?.skills.sort()).toEqual(['Go', 'Rust']);
    expect(project?.description).toBe('直した本文');
  });

  it('写した経験年数の上書きを入れ直す（FR-028）', async () => {
    await resumes.editSkillOverrides(
      target.id,
      [{ skillName: 'Go', months: 71 }],
      await times(target.id),
    );
    expect((await resumes.readContent(target.id)).skillOverrides).toEqual([
      { skillName: 'Go', months: 71 },
    ]);
  });

  it('ほかの職務経歴書の行は、この職務経歴書の id では直せない', async () => {
    expect(
      await resumes.editCareer(
        target.id,
        rows.otherCareer,
        careerContent(),
        await times(target.id),
      ),
    ).toEqual({ ok: false, reason: 'not-found' });
    expect((await resumes.readContent(other.id)).careers[0].organizationName).toBe(
      '元の作り物の組織名',
    );
  });
});

describe('楽観ロック（FR-038、research.md の R8）', () => {
  it('開いたときの更新日時が違えば、何も書かない', async () => {
    const stale = { openedUpdatedAt: '2000-01-01T00:00:00.000Z', now: NOW };
    expect(await resumes.editCareer(target.id, rows.career, careerContent(), stale)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(await resumes.editProject(target.id, rows.project, projectContent(), stale)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(await resumes.editSkillOverrides(target.id, [], stale)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(
      await resumes.editSettings(target.id, { title: '直した題', limitedExpiresAt: null }, stale),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await resumes.changeStatus(target.id, 'published', stale)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(await resumes.regenerateLimitedSlug(target.id, crypto.randomUUID(), stale)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect((await resumes.findForEdit(target.id))?.slug).toBe(target.slug);
    const content = await resumes.readContent(target.id);
    expect(content.careers[0].organizationName).toBe('元の作り物の組織名');
    expect(content.projects.find((p) => p.id === rows.project)?.skills).toEqual(['TypeScript']);
    expect(content.skillOverrides).toHaveLength(1);
    expect((await resumes.findForEdit(target.id))?.status).toBe('draft');
  });

  it('同じ職務経歴書の別の行でも、後の保存は止まる', async () => {
    const opened = await times(target.id);
    expect(await resumes.editCareer(target.id, rows.career, careerContent(), opened)).toEqual({
      ok: true,
    });
    expect(
      await resumes.editProject(target.id, rows.project, projectContent(), {
        ...opened,
        now: '2026-11-04T00:00:01.000Z',
      }),
    ).toEqual({ ok: false, reason: 'conflict' });
  });

  it('保存すると更新日時が新しい値になる', async () => {
    await resumes.changeStatus(target.id, 'published', await times(target.id));
    expect(await updatedAtOf(target.id)).toBe(NOW);
  });
});

describe('設定', () => {
  it('期限を直す。空にすると期限なし（FR-013）', async () => {
    await resumes.editSettings(
      target.id,
      { title: '直した題', limitedExpiresAt: '2026-12-01T00:00:00.000Z' },
      await times(target.id),
    );
    expect(await resumes.findForEdit(target.id)).toMatchObject({
      title: '直した題',
      limitedExpiresAt: '2026-12-01T00:00:00.000Z',
    });
    await resumes.editSettings(
      target.id,
      { title: '直した題', limitedExpiresAt: null },
      { openedUpdatedAt: NOW, now: '2026-11-05T00:00:00.000Z' },
    );
    expect((await resumes.findForEdit(target.id))?.limitedExpiresAt).toBeNull();
  });
});

describe('URL の出し直し（FR-040）', () => {
  it('識別子を渡した uid に書き換え、古い識別子では訪問者向けに読めない', async () => {
    await resumes.changeStatus(target.id, 'published', await times(target.id));
    expect(await resumes.findLimitedIdForVisitor(target.slug, NOW)).toBe(target.id);
    const content = await resumes.readContent(target.id);
    const slug = crypto.randomUUID();
    expect(
      await resumes.regenerateLimitedSlug(target.id, slug, {
        openedUpdatedAt: NOW,
        now: '2026-11-05T00:00:00.000Z',
      }),
    ).toEqual({ ok: true });
    expect(await resumes.findForEdit(target.id)).toMatchObject({
      slug,
      updatedAt: '2026-11-05T00:00:00.000Z',
    });
    expect(await resumes.findLimitedIdForVisitor(target.slug, NOW)).toBeNull();
    expect(await resumes.findLimitedIdForVisitor(slug, NOW)).toBe(target.id);
    expect(await resumes.readContent(target.id)).toEqual(content);
  });

  it('公開用と無い id は not-found で、書き換えない', async () => {
    const pub = await insertResume(env.DB, { audience: 'public' });
    expect(
      await resumes.regenerateLimitedSlug(pub.id, crypto.randomUUID(), await times(pub.id)),
    ).toEqual({ ok: false, reason: 'not-found' });
    expect((await resumes.findForEdit(pub.id))?.slug).toBe(pub.slug);
    expect(
      await resumes.regenerateLimitedSlug(999_999, crypto.randomUUID(), {
        openedUpdatedAt: NOW,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'not-found' });
  });

  it('ほかの職務経歴書と同じ識別子には書き換えない（FR-002）', async () => {
    await expect(
      resumes.regenerateLimitedSlug(target.id, other.slug, await times(target.id)),
    ).rejects.toThrow();
  });
});

describe('削除（research.md の R9）', () => {
  it('子の行から消し、ほかの職務経歴書と写し元は残る', async () => {
    expect(await resumes.delete(target.id)).toEqual({ ok: true });
    expect(await resumes.hasId(target.id)).toBe(false);
    for (const table of ['resume_career', 'resume_project', 'resume_education']) {
      const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE resume_id = ?`)
        .bind(target.id)
        .first<{ n: number }>();
      expect(row?.n, table).toBe(0);
    }
    const skills = await env.DB.prepare('SELECT count(*) AS n FROM resume_project_skill').first<{
      n: number;
    }>();
    expect(skills?.n).toBe(0);
    expect(await resumes.hasId(other.id)).toBe(true);
    const career = await env.DB.prepare('SELECT count(*) AS n FROM career').first<{ n: number }>();
    expect(career?.n).toBe(1);
  });

  it('無い id は消せない', async () => {
    expect(await resumes.delete(999_999)).toEqual({ ok: false });
  });
});

describe('管理画面の uid から id を引く（ADR-0048、specs/001-career-and-project/research.md の R17）', () => {
  it('職務経歴書の uid から id を引く。無い uid は null', async () => {
    expect(await resumes.findIdByUid(target.uid)).toBe(target.id);
    expect(await resumes.findIdByUid('0'.repeat(32))).toBeNull();
  });

  it('写した行の uid から id を引く。別の職務経歴書の行と、種類の違う行は null', async () => {
    const careerUid = await uidOf(env.DB, 'resume_career', rows.career);
    const otherCareerUid = await uidOf(env.DB, 'resume_career', rows.otherCareer);
    expect(await resumes.findRowIdByUid(target.id, 'careers', careerUid)).toBe(rows.career);
    expect(await resumes.findRowIdByUid(target.id, 'careers', otherCareerUid)).toBeNull();
    expect(await resumes.findRowIdByUid(target.id, 'projects', careerUid)).toBeNull();
  });

  it('読み出した写した行は uid を持つ', async () => {
    const content = await resumes.readContent(target.id);
    for (const row of [...content.careers, ...content.projects, ...content.educations]) {
      expect(row.uid).toMatch(/^[0-9a-f]{32}$/);
    }
  });
});
