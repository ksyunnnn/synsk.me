import { describe, expect, it } from 'vitest';
import { buildResumeContent } from '@/features/resume/domain/build-resume';
import type { ResumeSources } from '@/features/resume/domain/resume';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 写し方（specs/002-resume/spec.md の FR-007・FR-008・FR-010・FR-025・FR-028、data-model.md の
 * 「写し方」）。値はすべて作り物
 */

const period = (startedOn: string, endedOn: string | null = null) => ({
  startedOn: startedOn as CalendarDate,
  endedOn: endedOn as CalendarDate | null,
});

const SOURCES: ResumeSources = {
  careers: [
    {
      id: 1,
      organizationName: '実際の作り物株式会社',
      organizationNameMasked: 'ある会社',
      role: '作り物の肩書',
      isMasked: true,
      period: period('2020-04-01'),
      description: '職歴の本文',
      url: 'https://career.example.com',
    },
    {
      id: 2,
      organizationName: '選ばない作り物の組織',
      organizationNameMasked: null,
      role: '選ばない肩書',
      isMasked: false,
      period: period('2015-04-01', '2020-03-31'),
      description: null,
      url: null,
    },
  ],
  projects: [
    {
      id: 10,
      organizationName: '実際の作り物株式会社',
      organizationNameMasked: 'ある会社',
      kind: 'develop',
      title: '実際の作り物の受託開発',
      titleMasked: '業務システムの開発',
      isMasked: true,
      period: period('2021-04-01'),
      description: '実績の本文',
      url: 'https://project.example.com',
      skills: [
        { name: 'TypeScript', monthsOverride: 30 },
        { name: 'Go', monthsOverride: null },
      ],
    },
    {
      id: 11,
      organizationName: '作り物の個人',
      organizationNameMasked: '個人',
      kind: 'talk',
      title: '外す作り物の登壇',
      titleMasked: '登壇',
      isMasked: false,
      period: period('2022-01-01', '2022-01-01'),
      description: null,
      url: null,
      skills: [{ name: 'Rust', monthsOverride: 6 }],
    },
  ],
  educations: [
    {
      id: 20,
      school: '作り物大学',
      department: '作り物学部',
      period: period('2010-04-01', '2014-03-31'),
      remarks: null,
    },
  ],
};

const SELECT_SOME = { careerIds: [1], projectIds: [10], educationIds: [20] };

describe('限定公開用（FR-008・FR-010）', () => {
  const built = buildResumeContent(SOURCES, SELECT_SOME, 'limited');
  if (!built.ok) throw new Error(built.reason);
  const { content } = built;

  it('秘匿化した写し元も、実際の組織名・題・本文・関連 URL を写す', () => {
    expect(content.careers[0]).toMatchObject({
      organizationName: '実際の作り物株式会社',
      description: '職歴の本文',
      url: 'https://career.example.com',
    });
    expect(content.projects[0]).toMatchObject({
      organizationName: '実際の作り物株式会社',
      title: '実際の作り物の受託開発',
      description: '実績の本文',
      url: 'https://project.example.com',
    });
  });

  it('写し元が秘匿化していたかを写す（migration 0008）', () => {
    expect(content.careers[0].isMasked).toBe(true);
    expect(content.projects[0].isMasked).toBe(true);
  });

  it('選ばなかった行を写さない（FR-005）', () => {
    expect(content.careers.map((c) => c.careerId)).toEqual([1]);
    expect(content.projects.map((p) => p.projectId)).toEqual([10]);
    expect(JSON.stringify(content)).not.toContain('外す作り物の登壇');
  });

  it('写し元の id を写す', () => {
    expect(content.careers[0].careerId).toBe(1);
    expect(content.projects[0].projectId).toBe(10);
    expect(content.educations[0].educationId).toBe(20);
  });

  it('実績のスキルの名前を写す（FR-025）', () => {
    expect(content.projects[0].skills).toEqual(['TypeScript', 'Go']);
  });

  it('写した実績のスキルのうち、上書きを持つものだけ上書きを写す（FR-028）', () => {
    expect(content.skillOverrides).toEqual([{ skillName: 'TypeScript', months: 30 }]);
  });

  it('学歴の列を写す', () => {
    expect(content.educations[0]).toMatchObject({
      school: '作り物大学',
      department: '作り物学部',
      period: period('2010-04-01', '2014-03-31'),
    });
  });
});

it('何も選ばなければ、何も写さない（plan.md の U12 が決まるまで拒まない）', () => {
  expect(
    buildResumeContent(SOURCES, { careerIds: [], projectIds: [], educationIds: [] }, 'limited'),
  ).toEqual({
    ok: true,
    content: { careers: [], projects: [], educations: [], skillOverrides: [] },
  });
});

it('公開用は、tasks.md の Phase 7 で足すまで拒む', () => {
  expect(buildResumeContent(SOURCES, SELECT_SOME, 'public')).toEqual({
    ok: false,
    reason: 'public-not-supported',
  });
});
