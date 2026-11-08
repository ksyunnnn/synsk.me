import type { Profile } from '@/features/resume/domain/profile';
import type { ResumeContent, ResumeProjectKind } from '@/features/resume/domain/resume';
import { listResumeSkills, type ResumeSkill } from '@/features/resume/domain/resume-skills';
import type { Period } from '@/shared/domain/period';

/**
 * 訪問者に渡す職務経歴書の形（specs/002-resume/contracts/visitor-resume.md の DTO）。画面・
 * `<title>`・RSC の応答は、この形の値だけを使う。印刷（PDF）も同じページを使う（research.md の R11）。
 * 題・識別子・期限・状態・写し元の id は渡さない
 */

export type VisitorResumeCareer = {
  isMasked: false;
  organizationName: string;
  role: string;
  period: Period;
  body: string | null;
  url: string | null;
};

export type VisitorResumeProject = {
  isMasked: false;
  organizationName: string;
  kind: ResumeProjectKind;
  title: string;
  period: Period;
  skills: string[];
  body: string | null;
  url: string | null;
};

export type VisitorResumeEducation = {
  school: string;
  department: string | null;
  period: Period;
  remarks: string | null;
};

export type VisitorResume = {
  audience: 'limited';
  profile: Profile;
  careers: VisitorResumeCareer[];
  projects: VisitorResumeProject[];
  educations: VisitorResumeEducation[];
  skills: ResumeSkill[];
};

/**
 * 限定公開用の DTO。すべての写した職歴・実績を、秘匿化しない形で返す（FR-010）。
 * 経験年数は `now` の時点で求める（research.md の R12）
 */
export const toLimitedVisitorResume = (
  content: ResumeContent,
  profile: Profile,
  now: Date,
): VisitorResume => ({
  audience: 'limited',
  profile,
  careers: content.careers.map((career) => ({
    isMasked: false,
    organizationName: career.organizationName,
    role: career.role,
    period: career.period,
    body: career.description,
    url: career.url,
  })),
  projects: content.projects.map((project) => ({
    isMasked: false,
    organizationName: project.organizationName,
    kind: project.kind,
    title: project.title,
    period: project.period,
    skills: project.skills,
    body: project.description,
    url: project.url,
  })),
  educations: content.educations.map((education) => ({
    school: education.school,
    department: education.department,
    period: education.period,
    remarks: education.remarks,
  })),
  skills: listResumeSkills(content.projects, content.skillOverrides, now),
});
