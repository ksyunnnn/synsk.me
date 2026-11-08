import { describe, expect, it } from 'vitest';
import type { ResumeContent } from '@/features/resume/domain/resume';
import { toVisitorResume } from '@/features/resume/domain/visitor-resume';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 訪問者に渡す職務経歴書の形（specs/002-resume/contracts/visitor-resume.md、FR-010・FR-017・
 * FR-018）。値はすべて作り物
 */

const period = { startedOn: '2020-04-01' as CalendarDate, endedOn: null };
const UID = '0123456789abcdef0123456789abcdef';

/** 職務経歴書の中で、オーナーが秘匿化した行に本文を書き足した状態（FR-031） */
const CONTENT: ResumeContent = {
  careers: [
    {
      id: 1,
      uid: UID,
      careerId: 1,
      organizationName: 'ある会社',
      role: '作り物の肩書',
      period,
      description: '書き足した職歴の本文',
      url: 'https://career.example.com',
      isMasked: true,
    },
  ],
  projects: [
    {
      id: 2,
      uid: UID,
      projectId: 2,
      organizationName: 'ある会社',
      kind: 'application',
      title: '業務システムの開発',
      period,
      description: '書き足した実績の本文',
      url: 'https://project.example.com',
      isMasked: true,
      skills: ['TypeScript'],
    },
    {
      id: 3,
      uid: UID,
      projectId: 3,
      organizationName: '作り物の個人',
      kind: 'talk',
      title: '作り物の登壇',
      period,
      description: '登壇の本文',
      url: 'https://talk.example.com',
      isMasked: false,
      skills: [],
    },
  ],
  educations: [],
  skillOverrides: [],
};

const PROFILE = { name: '作り物の氏名', introduction: '作り物の自己紹介', email: null };
const NOW = new Date('2026-11-04T03:00:00Z');

describe('公開用（FR-017・FR-018）', () => {
  const resume = toVisitorResume('public', CONTENT, PROFILE, NOW);

  it('秘匿化した行は本文と関連 URL を持たない形にする', () => {
    expect(resume.careers[0]).toEqual({
      isMasked: true,
      organizationName: 'ある会社',
      role: '作り物の肩書',
      period,
    });
    expect(resume.projects[0]).toEqual({
      isMasked: true,
      organizationName: 'ある会社',
      kind: 'application',
      title: '業務システムの開発',
      period,
      skills: ['TypeScript'],
    });
  });

  it('オーナーが書き足した本文も出さない（FR-031）', () => {
    const text = JSON.stringify(resume);
    expect(text).not.toContain('書き足した');
    expect(text).not.toContain('career.example.com');
    expect(text).not.toContain('project.example.com');
  });

  it('秘匿化しない行は本文と関連 URL を出す', () => {
    expect(resume.projects[1]).toMatchObject({
      isMasked: false,
      body: '登壇の本文',
      url: 'https://talk.example.com',
    });
  });
});

it('限定公開用は、秘匿化した行も本文と関連 URL を出す（FR-010）', () => {
  const resume = toVisitorResume('limited', CONTENT, PROFILE, NOW);
  expect(resume.careers[0]).toMatchObject({ isMasked: false, body: '書き足した職歴の本文' });
  expect(resume.projects[0]).toMatchObject({
    isMasked: false,
    url: 'https://project.example.com',
  });
});
