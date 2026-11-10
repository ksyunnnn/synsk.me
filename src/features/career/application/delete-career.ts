import type { CareerId } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';

/**
 * 職歴を物理削除する（FR-007）。オーナーでなければ何も書かない（FR-040）。行を消してから、
 * その職歴の画像を置き場から消す。置き場から消し損ねた画像は、消し損ねの突き合わせ
 * （src/shared/server/sweep-orphaned-media.ts）が消し直す
 */
export const deleteCareer = async (
  { careers, media }: { careers: CareerRepository; media: Pick<MediaStorage, 'remove'> },
  author: Author | null,
  id: CareerId,
): Promise<{ status: 'deleted' | 'forbidden' | 'not-found' }> => {
  if (!author) return { status: 'forbidden' };
  const result = await careers.delete(id);
  if (!result.ok) return { status: 'not-found' };
  if (result.storageKeys.length > 0) await media.remove(result.storageKeys);
  return { status: 'deleted' };
};
