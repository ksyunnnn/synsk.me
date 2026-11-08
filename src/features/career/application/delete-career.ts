import type { CareerId } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { Author } from '@/shared/domain/author';

/** 職歴を物理削除する（FR-007）。オーナーでなければ何も書かない（FR-040） */
export const deleteCareer = async (
  careers: CareerRepository,
  author: Author | null,
  id: CareerId,
): Promise<{ status: 'deleted' | 'forbidden' | 'not-found' }> => {
  if (!author) return { status: 'forbidden' };
  return { status: (await careers.delete(id)).ok ? 'deleted' : 'not-found' };
};
