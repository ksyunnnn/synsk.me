import {
  decideProjectSlug,
  parseProjectContent,
  type ProjectField,
  type ProjectFieldError,
  type ProjectFormValues,
  type ProjectId,
} from '@/features/project/domain/project';
import type { Author } from '@/shared/domain/author';
import { checkOrganizationForSave } from '@/shared/domain/organization';
import type { ProjectDeps } from './deps';

export type EditProjectOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<ProjectField, ProjectFieldError>>;
      values: ProjectFormValues;
    }
  | { status: 'conflict'; values: ProjectFormValues };

/**
 * 実績を編集する（FR-011・FR-013・FR-042）。オーナーでなければ何も書かない（FR-040）。
 * 今の実績と組織を読み、識別子と決まりを確かめ、最後に書く
 */
export const editProject = async (
  { projects, organizations }: ProjectDeps,
  author: Author | null,
  id: ProjectId,
  values: ProjectFormValues,
  times: { openedUpdatedAt: string; now: string },
): Promise<EditProjectOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await projects.findForEdit(id);
  if (!current) return { status: 'not-found' };

  const parsed = parseProjectContent(values);
  const slug = decideProjectSlug(current, {
    isMasked: parsed.ok ? parsed.content.isMasked : values.isMasked !== '0',
    requestedSlug: values.slug,
  });
  if (!parsed.ok || !slug.ok) {
    return {
      status: 'invalid',
      errors: { ...(parsed.ok ? {} : parsed.errors), ...(slug.ok ? {} : { slug: slug.error }) },
      values,
    };
  }
  const { content } = parsed;

  const organizationError = await checkOrganizationForSave(organizations, content);
  if (organizationError) return { status: 'invalid', errors: organizationError, values };

  const result = await projects.edit(id, { ...content, slug: slug.slug }, times);
  if (result.ok) return { status: 'saved' };
  switch (result.reason) {
    case 'not-found':
      return { status: 'not-found' };
    case 'conflict':
      return { status: 'conflict', values };
    case 'slug-taken':
      return { status: 'invalid', errors: { slug: 'slug-taken' }, values };
    case 'masked-name-required':
      return {
        status: 'invalid',
        errors: { organizationNameMasked: 'masked-name-required' },
        values,
      };
  }
};
