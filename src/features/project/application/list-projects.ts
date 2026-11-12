import type {
  ProjectListFilter,
  ProjectOrganizationOption,
  ProjectSummary,
} from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';

/** オーナーの一覧と、組織で絞る選択肢。`filter` は、実際に絞った条件 */
export type ProjectList = {
  projects: ProjectSummary[];
  organizations: ProjectOrganizationOption[];
  filter: ProjectListFilter;
};

/**
 * オーナーの実績の一覧（issue #330）。種類・組織・サイトに載せるか・秘匿化するかの、どの条件も
 * 満たす実績だけを返す。実績を持つ組織に無い uid では、組織で絞らない
 */
export const listProjects = async (
  projects: ProjectRepository,
  requested: ProjectListFilter,
): Promise<ProjectList> => {
  const organizations = await projects.listOrganizationOptions();
  const organizationUid = organizations.some((o) => o.uid === requested.organizationUid)
    ? requested.organizationUid
    : null;
  const filter = { ...requested, organizationUid };
  return { projects: await projects.list(filter), organizations, filter };
};
