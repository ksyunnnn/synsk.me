import type { CareerDeps } from '@/features/career/application/deps';
import type { CareerId } from '@/features/career/domain/career';
import type { Author } from '@/shared/domain/author';

/**
 * 職歴を物理削除する（FR-007）。D1 の行を消してから、その職歴の画像を置き場から消す。置き場から
 * 消せずに残っても、指す行が無いため返らない（`media` の行を正とする）。
 * オーナーでなければ何も書かない（FR-040）
 */
export const deleteCareer = async (
  { careers, images }: Pick<CareerDeps, 'careers' | 'images'>,
  author: Author | null,
  id: CareerId,
): Promise<{ status: 'deleted' | 'forbidden' | 'not-found' }> => {
  if (!author) return { status: 'forbidden' };
  const result = await careers.delete(id);
  if (!result.ok) return { status: 'not-found' };
  await images.delete(result.storageKeys);
  return { status: 'deleted' };
};
