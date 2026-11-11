import type { ProjectId } from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';

export type DeleteProjectOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * 実績を物理削除する（FR-011）。オーナーでなければ何も書かない（FR-040）。行を消してから、
 * その実績の画像を置き場から消す。置き場から消し損ねた画像は、消し損ねの突き合わせ
 * （src/shared/server/sweep-orphaned-media.ts）が消し直す
 */
export const deleteProject = async (
  { projects, media }: { projects: ProjectRepository; media: Pick<MediaStorage, 'remove'> },
  author: Author | null,
  id: ProjectId,
): Promise<DeleteProjectOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await projects.delete(id);
  if (!result.ok) return { status: 'not-found' };
  if (result.storageKeys.length > 0) await media.remove(result.storageKeys);
  return { status: 'deleted' };
};
