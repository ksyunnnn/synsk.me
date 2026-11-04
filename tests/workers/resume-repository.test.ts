import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildResumeContent } from '@/features/resume/domain/build-resume';
import type { NewResume, ResumeSelection } from '@/features/resume/domain/resume';
import { createD1ResumeRepository } from '@/features/resume/server/d1-resume-repository';
import type { CalendarDate } from '@/shared/domain/period';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
  insertSkill,
  linkProjectSkill,
} from '../support/career-and-project-rows';
import { deleteResumeRows, insertResume } from '../support/resume-rows';

/**
 * `ResumeRepository` の D1 の実装の、作成と読み出し（specs/002-resume/spec.md の FR-007・FR-009・
 * FR-011〜FR-014・FR-021〜FR-023・FR-025・FR-028、research.md の R4・R6）。値はすべて作り物
 */

const resumes = createD1ResumeRepository(env.DB);

const NOW = '2026-11-04T00:00:00.000Z';
const HASH = 'a'.repeat(64);

/** `limited_token_hash` は UNIQUE。作るたびに違う値にする */
const randomHash = () => crypto.randomUUID().replaceAll('-', '').padEnd(64, '0');

let ids: { careers: number[]; projects: number[]; educations: number[]; skill: number };

const selectAll = (): ResumeSelection => ({
  careerIds: ids.careers,
  projectIds: ids.projects,
  educationIds: ids.educations,
});

const newResume = async (overrides: Partial<NewResume> = {}): Promise<NewResume> => {
  const sources = await resumes.readSources(selectAll());
  const built = buildResumeContent(sources, selectAll(), 'limited');
  if (!built.ok) throw new Error(built.reason);
  return {
    slug: crypto.randomUUID(),
    title: '作り物の提出先',
    audience: 'limited',
    limitedTokenHash: randomHash(),
    limitedExpiresAt: null,
    content: built.content,
    ...overrides,
  };
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteResumeRows(env.DB);
  await deleteCareerAndProjectRows(env.DB);
  const org = await insertOrganization(env.DB, { name: '実際の作り物株式会社' });
  const skill = await insertSkill(env.DB, { name: 'TypeScript', monthsOverride: 30 });
  const older = await insertProject(env.DB, {
    organizationId: org,
    title: '古い作り物の実績',
    startedOn: '2019-04-01',
    endedOn: '2020-03-31',
  });
  const newer = await insertProject(env.DB, {
    organizationId: org,
    title: '新しい作り物の実績',
    startedOn: '2023-04-01',
  });
  await linkProjectSkill(env.DB, newer, skill);
  ids = {
    careers: [
      await insertCareer(env.DB, { organizationId: org, startedOn: '2015-04-01' }),
      await insertCareer(env.DB, {
        organizationId: org,
        role: '新しい肩書',
        startedOn: '2021-04-01',
      }),
    ],
    projects: [older, newer],
    educations: [await insertEducation(env.DB)],
    skill,
  };
});

describe('readSources', () => {
  it('選んだ id だけを、始まりの日の新しい順で読む', async () => {
    const sources = await resumes.readSources({
      careerIds: ids.careers,
      projectIds: [ids.projects[1]],
      educationIds: [],
    });
    expect(sources.careers.map((c) => c.id)).toEqual([ids.careers[1], ids.careers[0]]);
    expect(sources.projects.map((p) => p.title)).toEqual(['新しい作り物の実績']);
    expect(sources.projects[0].skills).toEqual([{ name: 'TypeScript', monthsOverride: 30 }]);
    expect(sources.educations).toEqual([]);
  });

  it('all ならすべてを読む', async () => {
    const sources = await resumes.readSources('all');
    expect(sources.careers).toHaveLength(2);
    expect(sources.projects).toHaveLength(2);
    expect(sources.educations).toHaveLength(1);
  });
});

describe('create', () => {
  it('resume と写した行が入り、下書きで、写した行が始まりの日の新しい順で読める（FR-009・FR-021）', async () => {
    const { id } = await resumes.create(await newResume());
    const resume = await resumes.findForEdit(id);
    expect(resume).toMatchObject({ status: 'draft', audience: 'limited', limitedExpiresAt: null });
    expect(resume?.careers.map((c) => c.role)).toEqual(['新しい肩書', '作り物の肩書']);
    expect(resume?.projects.map((p) => p.title)).toEqual([
      '新しい作り物の実績',
      '古い作り物の実績',
    ]);
    expect(resume?.educations).toHaveLength(1);
  });

  it('子の行の resume_id と、写したスキルの resume_project_id が正しい（FR-025・FR-028）', async () => {
    const { id: other } = await resumes.create(await newResume());
    const { id } = await resumes.create(await newResume());
    const resume = await resumes.findForEdit(id);
    expect(resume?.projects.find((p) => p.title === '新しい作り物の実績')?.skills).toEqual([
      'TypeScript',
    ]);
    expect(resume?.projects.find((p) => p.title === '古い作り物の実績')?.skills).toEqual([]);
    expect(resume?.skillOverrides).toEqual([{ skillName: 'TypeScript', months: 30 }]);
    const counts = await env.DB.prepare(
      'SELECT resume_id, count(*) AS n FROM resume_career GROUP BY resume_id ORDER BY resume_id',
    ).all<{ resume_id: number; n: number }>();
    expect(counts.results).toEqual([
      { resume_id: other, n: 2 },
      { resume_id: id, n: 2 },
    ]);
  });

  it('途中の文が失敗すると、何も残らない（research.md の R4）', async () => {
    const resume = await newResume();
    resume.content.educations.push({
      educationId: null,
      school: '作り物大学',
      department: null,
      period: { startedOn: '2020-02-30' as CalendarDate, endedOn: null },
      remarks: null,
    });
    await expect(resumes.create(resume)).rejects.toThrow();
    for (const table of ['resume', 'resume_career', 'resume_project', 'resume_project_skill']) {
      const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
      expect(row?.n, table).toBe(0);
    }
  });

  it('limited_token_hash に渡したハッシュだけを持つ（FR-012）', async () => {
    const { id } = await resumes.create(await newResume({ limitedTokenHash: HASH }));
    const row = await env.DB.prepare('SELECT limited_token_hash FROM resume WHERE id = ?')
      .bind(id)
      .first<{ limited_token_hash: string }>();
    expect(row?.limited_token_hash).toBe(HASH);
  });

  it('同じ識別子の 2 つ目は入らない（FR-002）', async () => {
    const slug = 'fake-same-slug';
    await resumes.create(await newResume({ slug }));
    await expect(resumes.create(await newResume({ slug }))).rejects.toThrow();
  });
});

describe('元を直しても写した値は変わらない（FR-007・FR-025・FR-028）', () => {
  it('元のスキル名と上書きを直しても、写したスキル名と上書きは変わらない', async () => {
    const { id } = await resumes.create(await newResume());
    await env.DB.prepare('UPDATE skill SET name = ?, months_override = ? WHERE id = ?')
      .bind('直したスキル名', 99, ids.skill)
      .run();
    const resume = await resumes.findForEdit(id);
    expect(resume?.projects.flatMap((p) => p.skills)).toEqual(['TypeScript']);
    expect(resume?.skillOverrides).toEqual([{ skillName: 'TypeScript', months: 30 }]);
  });
});

describe('findLimitedIdForVisitor（FR-011・FR-014・FR-022・FR-023、research.md の R6）', () => {
  it('訪問者に見せる状態で鍵が合い、期限が無ければ返す', async () => {
    const r = await insertResume(env.DB, { status: 'published' });
    expect(await resumes.findLimitedIdForVisitor(r.slug, r.key!, NOW)).toBe(r.id);
  });

  it('期限の前なら返す', async () => {
    const r = await insertResume(env.DB, {
      status: 'published',
      expiresAt: '2026-11-05T00:00:00.000Z',
    });
    expect(await resumes.findLimitedIdForVisitor(r.slug, r.key!, NOW)).toBe(r.id);
  });

  it('下書きは返さない', async () => {
    const r = await insertResume(env.DB, { status: 'draft' });
    expect(await resumes.findLimitedIdForVisitor(r.slug, r.key!, NOW)).toBeNull();
  });

  it('期限を過ぎたら返さない。期限ちょうども返さない', async () => {
    const past = await insertResume(env.DB, {
      status: 'published',
      expiresAt: '2026-11-03T23:59:59.999Z',
    });
    const exact = await insertResume(env.DB, { status: 'published', expiresAt: NOW });
    expect(await resumes.findLimitedIdForVisitor(past.slug, past.key!, NOW)).toBeNull();
    expect(await resumes.findLimitedIdForVisitor(exact.slug, exact.key!, NOW)).toBeNull();
  });

  it('鍵が違えば返さない', async () => {
    const r = await insertResume(env.DB, { status: 'published' });
    const other = await insertResume(env.DB, { status: 'published' });
    expect(await resumes.findLimitedIdForVisitor(r.slug, other.key!, NOW)).toBeNull();
  });

  it('識別子が違えば返さない', async () => {
    const r = await insertResume(env.DB, { status: 'published' });
    expect(await resumes.findLimitedIdForVisitor('no-such-slug', r.key!, NOW)).toBeNull();
  });

  it('公開用の識別子では返さない', async () => {
    const r = await insertResume(env.DB, { status: 'published', audience: 'public' });
    expect(await resumes.findLimitedIdForVisitor(r.slug, 'k'.repeat(43), NOW)).toBeNull();
  });
});

describe('作った後', () => {
  it('限定公開用を公開用に変えられない（FR-004、トリガ resume_audience_fixed）', async () => {
    const r = await insertResume(env.DB);
    await expect(
      env.DB.prepare(
        "UPDATE resume SET audience = 'public', limited_token_hash = NULL WHERE id = ?",
      )
        .bind(r.id)
        .run(),
    ).rejects.toThrow(/resume_audience_fixed/);
  });

  it('一覧は作った順の新しい順', async () => {
    const a = await resumes.create(await newResume({ title: '先' }));
    const b = await resumes.create(await newResume({ title: '後' }));
    expect((await resumes.list()).map((r) => r.id)).toEqual([b.id, a.id]);
  });
});
