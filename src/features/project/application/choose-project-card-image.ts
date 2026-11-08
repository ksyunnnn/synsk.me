import type { ProjectDeps } from '@/features/project/application/deps';
import type { ProjectId } from '@/features/project/domain/project';
import type { Author } from '@/shared/domain/author';
import { isImageFile, toStorageKey } from '@/shared/domain/media-image';

/**
 * 実績の代表画像を選ぶ（FR-028）。その実績の画像だけを選べる。空のファイル名なら代表画像を
 * 外す。オーナーでなければ何も書かない（FR-040）
 */
export const chooseProjectCardImage = async (
  { projects }: Pick<ProjectDeps, 'projects'>,
  author: Author | null,
  id: ProjectId,
  file: string,
): Promise<{ status: 'done' | 'forbidden' | 'not-found' | 'not-own-image' }> => {
  if (!author) return { status: 'forbidden' };
  if (file !== '' && !isImageFile(file)) return { status: 'not-own-image' };
  const result = await projects.chooseCardImage(
    id,
    file === '' ? null : toStorageKey('projects', file),
  );
  return result.ok ? { status: 'done' } : { status: result.reason };
};
