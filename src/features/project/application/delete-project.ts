import type { ProjectDeps } from '@/features/project/application/deps';
import type { ProjectId } from '@/features/project/domain/project';
import type { Author } from '@/shared/domain/author';

export type DeleteProjectOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * 実績を物理削除する（FR-011）。D1 の行を消してから、その実績の画像を置き場から消す。置き場から
 * 消せずに残っても、指す行が無いため訪問者には返らない（`media` の行を正とする）。
 * オーナーでなければ何も書かない（FR-040）
 */
export const deleteProject = async (
  { projects, images }: Pick<ProjectDeps, 'projects' | 'images'>,
  author: Author | null,
  id: ProjectId,
): Promise<DeleteProjectOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await projects.delete(id);
  if (!result.ok) return { status: 'not-found' };
  await images.delete(result.storageKeys);
  return { status: 'deleted' };
};
