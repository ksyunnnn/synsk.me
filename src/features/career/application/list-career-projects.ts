import {
  projectsOfCareer,
  skillsOfCareer,
  type Career,
  type CareerProjectSource,
} from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';

export type CareerProjects = { projects: CareerProjectSource[]; skills: string[] };

/**
 * 職歴の実績とスキル（specs/001-career-and-project/spec.md の FR-017・FR-035）。読む → 計算の順
 * （docs/SOFTWARE_DESIGN.md）。組織の実績を読み、職歴と期間が重なるものを選び、そのスキルを
 * 合わせる。実際の題を返すため、管理画面だけが使う
 */
export const listCareerProjects = async (
  careers: CareerRepository,
  career: Pick<Career, 'organization' | 'period'>,
): Promise<CareerProjects> => {
  const projects = projectsOfCareer(
    career,
    await careers.listProjectsOfOrganization(career.organization.id),
  );
  return { projects, skills: skillsOfCareer(projects) };
};
