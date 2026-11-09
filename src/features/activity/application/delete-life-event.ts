import { removeFromStorage } from '@/features/activity/application/life-event-image';
import type { LifeEventId } from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';

export type DeleteLifeEventOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/**
 * life event の行と画像を消す（FR-023・FR-027）。D1 の行を消してから、置き場のものを消す
 * （research.md の R12）。オーナーでなければ何も消さない（FR-031）
 */
export const deleteLifeEvent = async (
  lifeEvents: LifeEventRepository,
  storage: MediaStorage,
  author: Author | null,
  id: LifeEventId,
): Promise<DeleteLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };
  const result = await lifeEvents.delete(id);
  if (!result.ok) return { status: 'not-found' };
  await removeFromStorage(storage, result.removedKeys);
  return { status: 'deleted' };
};
