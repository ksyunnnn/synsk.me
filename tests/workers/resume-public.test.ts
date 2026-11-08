import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildResumeContent } from '@/features/resume/domain/build-resume';
import type { ResumeSelection } from '@/features/resume/domain/resume';
import { createD1ResumeRepository } from '@/features/resume/server/d1-resume-repository';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertOrganization,
  insertProject,
} from '../support/career-and-project-rows';
import {
  deleteResumeRows,
  insertResume,
  insertResumeCareer,
  insertResumeProject,
} from '../support/resume-rows';

/**
 * 公開用の職務経歴書の D1 の実装（specs/002-resume/spec.md の FR-016・FR-017・FR-019・FR-039、
 * contracts/visitor-resume.md、tasks.md の T063）。値はすべて作り物
 */

const resumes = createD1ResumeRepository(env.DB);
const TIMES = { openedUpdatedAt: '', now: '2026-11-04T00:00:00.000Z' };

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteResumeRows(env.DB);
  await deleteCareerAndProjectRows(env.DB);
});

const updatedAtOf = async (id: number) =>
  (
    await env.DB.prepare('SELECT updated_at FROM resume WHERE id = ?')
      .bind(id)
      .first<{ updated_at: string }>()
  )?.updated_at ?? '';

describe('公開用は 1 つだけ（FR-019）', () => {
  it('公開用が無ければ hasPublic は false、あれば true', async () => {
    await insertResume(env.DB, { audience: 'limited' });
    expect(await resumes.hasPublic()).toBe(false);
    await insertResume(env.DB, { audience: 'public' });
    expect(await resumes.hasPublic()).toBe(true);
  });

  it('2 つ目の公開用は D1 も拒む（`resume_public` の UNIQUE）', async () => {
    await insertResume(env.DB, { audience: 'public' });
    await expect(insertResume(env.DB, { audience: 'public' })).rejects.toThrow();
  });
});

describe('公開用の識別子を書き換える（FR-039）', () => {
  it('公開用は識別子を書き換えられ、新しい識別子で読める', async () => {
    const r = await insertResume(env.DB, { audience: 'public', status: 'published' });
    const times = { ...TIMES, openedUpdatedAt: await updatedAtOf(r.id) };
    expect(
      await resumes.editSettings(
        r.id,
        { title: '作り物', limitedExpiresAt: null, slug: 'resume' },
        times,
      ),
    ).toEqual({ ok: true });
    expect(await resumes.findPublicIdForVisitor('resume')).toBe(r.id);
    expect(await resumes.findPublicIdForVisitor(r.slug)).toBeNull();
  });

  it('限定公開用は、識別子を渡されても書き換えない（FR-037）', async () => {
    const r = await insertResume(env.DB, { audience: 'limited' });
    const times = { ...TIMES, openedUpdatedAt: await updatedAtOf(r.id) };
    await resumes.editSettings(
      r.id,
      { title: '作り物', limitedExpiresAt: null, slug: 'mine' },
      times,
    );
    const row = await env.DB.prepare('SELECT slug FROM resume WHERE id = ?')
      .bind(r.id)
      .first<{ slug: string }>();
    expect(row?.slug).toBe(r.slug);
  });

  it('isSlugTaken は、自分以外が使う識別子だけを true にする', async () => {
    const a = await insertResume(env.DB, { slug: 'resume', audience: 'public' });
    const b = await insertResume(env.DB, { audience: 'limited' });
    expect(await resumes.isSlugTaken('resume', a.id)).toBe(false);
    expect(await resumes.isSlugTaken('resume', b.id)).toBe(true);
    expect(await resumes.isSlugTaken('free', b.id)).toBe(false);
  });
});

describe('訪問者向けの取り出し（FR-017・FR-022、contracts/visitor-resume.md）', () => {
  it('公開中の公開用だけ id を返す。非公開と限定公開用は返さない', async () => {
    const published = await insertResume(env.DB, { audience: 'public', status: 'published' });
    expect(await resumes.findPublicIdForVisitor(published.slug)).toBe(published.id);
    await env.DB.prepare("UPDATE resume SET status = 'draft' WHERE id = ?")
      .bind(published.id)
      .run();
    expect(await resumes.findPublicIdForVisitor(published.slug)).toBeNull();
    const limited = await insertResume(env.DB, { audience: 'limited', status: 'published' });
    expect(await resumes.findPublicIdForVisitor(limited.slug)).toBeNull();
  });

  it('公開用で秘匿化した行の description・url を返さない。書き足した本文も返さない', async () => {
    const r = await insertResume(env.DB, { audience: 'public', status: 'published' });
    await insertResumeCareer(env.DB, {
      resumeId: r.id,
      description: '書き足した職歴の本文',
      url: 'https://career.example.com',
      isMasked: true,
    });
    await insertResumeProject(env.DB, {
      resumeId: r.id,
      description: '書き足した実績の本文',
      url: 'https://project.example.com',
      isMasked: true,
    });
    await insertResumeProject(env.DB, {
      resumeId: r.id,
      title: '秘匿化しない作り物の実績',
      description: '秘匿化しない本文',
      url: 'https://open.example.com',
      isMasked: false,
    });

    const read = await resumes.readVisitorContent(r.id);
    expect(read?.audience).toBe('public');
    expect(read?.content.careers[0]).toMatchObject({ description: null, url: null });
    const masked = read?.content.projects.find((p) => p.isMasked);
    expect(masked).toMatchObject({ description: null, url: null });
    const open = read?.content.projects.find((p) => !p.isMasked);
    expect(open).toMatchObject({
      description: '秘匿化しない本文',
      url: 'https://open.example.com',
    });
  });

  it('限定公開用は、秘匿化した行も description・url を返す（FR-010）', async () => {
    const r = await insertResume(env.DB, { audience: 'limited', status: 'published' });
    await insertResumeCareer(env.DB, {
      resumeId: r.id,
      description: '限定公開用の本文',
      isMasked: true,
    });
    const read = await resumes.readVisitorContent(r.id);
    expect(read?.content.careers[0].description).toBe('限定公開用の本文');
  });

  it('無い id なら null', async () => {
    expect(await resumes.readVisitorContent(999_999)).toBeNull();
  });
});

describe('公開用の写し方を D1 の写し元で（FR-016）', () => {
  it('readSources はサイトに載せるかを返し、公開用はサイトに載せない行を写さない', async () => {
    const org = await insertOrganization(env.DB, { name: '実際の作り物株式会社' });
    const onSite = await insertCareer(env.DB, { organizationId: org, status: 'published' });
    const offSite = await insertCareer(env.DB, { organizationId: org, status: 'draft' });
    const project = await insertProject(env.DB, {
      organizationId: org,
      title: '実際の作り物の題',
      titleMasked: '作り物の秘匿化した題',
      status: 'published',
      isMasked: true,
    });
    const selection: ResumeSelection = {
      careerIds: [onSite, offSite],
      projectIds: [project],
      educationIds: [],
    };
    const sources = await resumes.readSources(selection);
    expect(sources.careers.map((c) => [c.id, c.status])).toEqual(
      expect.arrayContaining([
        [onSite, 'published'],
        [offSite, 'draft'],
      ]),
    );

    const built = buildResumeContent(sources, selection, 'public');
    if (!built.ok) throw new Error(built.reason);
    expect(built.content.careers.map((c) => c.careerId)).toEqual([onSite]);
    expect(built.content.projects[0]).toMatchObject({
      organizationName: 'ある会社',
      title: '作り物の秘匿化した題',
      description: null,
    });

    const { id } = await resumes.create({
      slug: 'resume',
      title: '作り物の公開用',
      audience: 'public',
      limitedExpiresAt: null,
      content: built.content,
    });
    const text = JSON.stringify(await resumes.readContent(id));
    expect(text).not.toContain('実際の作り物株式会社');
    expect(text).not.toContain('実際の作り物の題');
  });
});
