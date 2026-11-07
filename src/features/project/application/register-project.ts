import {
  newProjectSlug,
  parseProjectContent,
  type ProjectFieldError,
  type ProjectFormValues,
  type ProjectId,
  type ProjectField,
} from '@/features/project/domain/project';
import type { Author } from '@/shared/domain/author';
import { canSaveWithOrganization } from '@/shared/domain/organization';
import type { ProjectDeps } from './deps';

export type RegisterProjectOutcome =
  | { status: 'registered'; id: ProjectId }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<ProjectField, ProjectFieldError>>;
      values: ProjectFormValues;
    };

/**
 * 実績を登録する（FR-011・FR-013・FR-015）。作り手でなければ何も書かない（FR-040）。
 * 組織を読み、決まりを確かめ、最後に書く（docs/SOFTWARE_DESIGN.md の「読む → 計算 → 書く」）
 */
export const registerProject = async (
  { projects, organizations }: ProjectDeps,
  author: Author | null,
  values: ProjectFormValues,
): Promise<RegisterProjectOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = parseProjectContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const { content } = parsed;

  const organization = await organizations.findByName(content.organizationName);
  if (!canSaveWithOrganization(organization, content)) {
    return {
      status: 'invalid',
      errors: { organizationNameMasked: 'masked-name-required' },
      values,
    };
  }

  const result = await projects.register({ ...content, slug: newProjectSlug() });
  if (result.ok) return { status: 'registered', id: result.id };
  return {
    status: 'invalid',
    errors:
      result.reason === 'slug-taken'
        ? { slug: 'slug-taken' }
        : { organizationNameMasked: 'masked-name-required' },
    values,
  };
};
