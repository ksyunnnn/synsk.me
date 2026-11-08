import type { Profile } from '@/features/resume/domain/profile';
import type {
  ResumeAudience,
  ResumeContent,
  ResumeProjectKind,
} from '@/features/resume/domain/resume';
import { listResumeSkills, type ResumeSkill } from '@/features/resume/domain/resume-skills';
import type { Period } from '@/shared/domain/period';

/**
 * 訪問者に渡す職務経歴書の形（specs/002-resume/contracts/visitor-resume.md の DTO）。画面・
 * `<title>`・RSC の応答は、この形の値だけを使う。印刷（PDF）も同じページを使う（research.md の R11）。
 * 題・識別子・期限・状態・写し元の id は渡さない。
 *
 * 公開用で秘匿化した職歴・実績は `isMasked: true` の形で、本文と関連 URL を持たない（FR-017・
 * FR-018）。組織名と題は、写すときに秘匿化した値で写している（build-resume.ts）
 */

export type VisitorResumeCareer = VisitorResumeOpenCareer | VisitorResumeMaskedCareer;

export type VisitorResumeOpenCareer = {
  isMasked: false;
  organizationName: string;
  role: string;
  period: Period;
  body: string | null;
  url: string | null;
};

/** 公開用で秘匿化した職歴。出してよいのは秘匿化した組織名・肩書・期間だけ（FR-018） */
export type VisitorResumeMaskedCareer = {
  isMasked: true;
  organizationName: string;
  role: string;
  period: Period;
};

export type VisitorResumeProject = VisitorResumeOpenProject | VisitorResumeMaskedProject;

export type VisitorResumeOpenProject = {
  isMasked: false;
  organizationName: string;
  kind: ResumeProjectKind;
  title: string;
  period: Period;
  skills: string[];
  body: string | null;
  url: string | null;
};

/** 公開用で秘匿化した実績。出してよいのは秘匿化した組織名・秘匿化した題・期間・種類・スキルだけ（FR-018） */
export type VisitorResumeMaskedProject = {
  isMasked: true;
  organizationName: string;
  kind: ResumeProjectKind;
  title: string;
  period: Period;
  skills: string[];
};

export type VisitorResumeEducation = {
  school: string;
  department: string | null;
  period: Period;
  remarks: string | null;
};

export type VisitorResume = {
  audience: ResumeAudience;
  profile: Profile;
  careers: VisitorResumeCareer[];
  projects: VisitorResumeProject[];
  educations: VisitorResumeEducation[];
  skills: ResumeSkill[];
};

/**
 * 訪問者に見せる DTO。限定公開用は、すべての写した職歴・実績を秘匿化しない形で返す（FR-010）。
 * 公開用は、写したときに秘匿化していた行を `isMasked: true` の形にし、本文と関連 URL を落とす
 * （FR-017）。経験年数は `now` の時点で求める（research.md の R12）
 */
export const toVisitorResume = (
  audience: ResumeAudience,
  content: ResumeContent,
  profile: Profile,
  now: Date,
): VisitorResume => {
  const hides = (row: { isMasked: boolean }) => audience === 'public' && row.isMasked;
  return {
    audience,
    profile,
    careers: content.careers.map((career): VisitorResumeCareer => {
      const base = {
        organizationName: career.organizationName,
        role: career.role,
        period: career.period,
      };
      return hides(career)
        ? { isMasked: true, ...base }
        : { isMasked: false, ...base, body: career.description, url: career.url };
    }),
    projects: content.projects.map((project): VisitorResumeProject => {
      const base = {
        organizationName: project.organizationName,
        kind: project.kind,
        title: project.title,
        period: project.period,
        skills: project.skills,
      };
      return hides(project)
        ? { isMasked: true, ...base }
        : { isMasked: false, ...base, body: project.description, url: project.url };
    }),
    educations: content.educations.map((education) => ({
      school: education.school,
      department: education.department,
      period: education.period,
      remarks: education.remarks,
    })),
    skills: listResumeSkills(content.projects, content.skillOverrides, now),
  };
};

/** 限定公開用の DTO（FR-010） */
export const toLimitedVisitorResume = (
  content: ResumeContent,
  profile: Profile,
  now: Date,
): VisitorResume => toVisitorResume('limited', content, profile, now);
