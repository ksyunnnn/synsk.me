import type { VisitorLifeEvent } from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';

/** 訪問者に見せる life event（FR-026・FR-034）。無い識別子なら null */
export const getVisitorLifeEvent = (
  lifeEvents: LifeEventRepository,
  slug: string,
): Promise<VisitorLifeEvent | null> => lifeEvents.findVisitorBySlug(slug);
