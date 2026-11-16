import { describe, expect, it } from 'vitest';
import { toProfile } from '@/features/resume/domain/profile';
import {
  visitorResumeMediaAccess,
  type VisitorResume,
} from '@/features/resume/domain/visitor-resume';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 限定公開用の職務経歴書の本文の画像を見せてよいか。本文に印が書かれた画像だけを、キャッシュに
 * 残さない `restricted` で見せる
 */

const CAREER_KEY = '11111111-1111-4111-8111-111111111111';
const PROJECT_KEY = '22222222-2222-4222-8222-222222222222';
const OTHER_KEY = '33333333-3333-4333-8333-333333333333';
const period = { startedOn: '2021-04-01' as CalendarDate, endedOn: null };

const resume: VisitorResume = {
  audience: 'limited',
  profile: toProfile(undefined),
  careers: [
    {
      isMasked: false,
      organizationName: '作り物株式会社',
      role: '役割',
      period,
      body: `職歴\n\n![](media:${CAREER_KEY})`,
      url: null,
    },
  ],
  projects: [
    {
      isMasked: false,
      organizationName: '作り物株式会社',
      kind: 'develop',
      title: '題',
      period,
      skills: [],
      body: `本文の中の ![図](media:${PROJECT_KEY}) の画像`,
      url: null,
    },
    {
      isMasked: false,
      organizationName: '作り物株式会社',
      kind: 'develop',
      title: '本文なし',
      period,
      skills: [],
      body: null,
      url: null,
    },
  ],
  educations: [],
  skills: [],
};

describe('visitorResumeMediaAccess', () => {
  it('職歴か実績の本文に書かれた画像は restricted、ほかは hidden', () => {
    expect(visitorResumeMediaAccess(resume, CAREER_KEY)).toBe('restricted');
    expect(visitorResumeMediaAccess(resume, PROJECT_KEY)).toBe('restricted');
    expect(visitorResumeMediaAccess(resume, OTHER_KEY)).toBe('hidden');
  });

  it('見せない職務経歴書（null）の画像は hidden', () => {
    expect(visitorResumeMediaAccess(null, CAREER_KEY)).toBe('hidden');
  });
});
