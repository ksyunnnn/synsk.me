import type { ExternalActivityRepository } from '@/features/activity/domain/activity-repository';
import type { ExternalActivityId } from '@/features/activity/domain/external-activity';
import type { Author } from '@/shared/domain/author';

export type DeleteExternalActivityOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * URL を指名した・手で入力した外部の activity を消す（FR-033）。一覧を取る取得元の activity と
 * life event は Repository が消さず、無い行として扱う（FR-022）。オーナーでなければ何も消さない
 * （FR-031）
 */
export const deleteExternalActivity = async (
  activities: ExternalActivityRepository,
  author: Author | null,
  id: ExternalActivityId,
): Promise<DeleteExternalActivityOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await activities.delete(id)) ? { status: 'deleted' } : { status: 'not-found' };
};
