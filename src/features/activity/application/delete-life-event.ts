import type { LifeEventId } from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';

export type DeleteLifeEventOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/** life event の行を消す（FR-023・FR-027）。オーナーでなければ何も消さない（FR-031） */
export const deleteLifeEvent = async (
  lifeEvents: LifeEventRepository,
  author: Author | null,
  id: LifeEventId,
): Promise<DeleteLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await lifeEvents.delete(id)).ok ? { status: 'deleted' } : { status: 'not-found' };
};
