import {
  parseLifeEventInput,
  type LifeEventField,
  type LifeEventFieldError,
  type LifeEventFormValues,
  type LifeEventId,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

export type RegisterLifeEventOutcome =
  | { status: 'registered'; id: LifeEventId; uid: Uid }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<LifeEventField, LifeEventFieldError>>;
      values: LifeEventFormValues;
    };

/**
 * life event を作る（FR-023・FR-024・FR-025・FR-035）。オーナーでなければ何も書かない（FR-031）。
 * 識別子が空なら、推測できない値を入れる
 */
export const registerLifeEvent = async (
  lifeEvents: LifeEventRepository,
  author: Author | null,
  values: LifeEventFormValues,
): Promise<RegisterLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = parseLifeEventInput(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };

  const result = await lifeEvents.register(parsed.content);
  return result.ok
    ? { status: 'registered', id: result.id, uid: result.uid }
    : { status: 'invalid', errors: { slug: 'slug-taken' }, values };
};
