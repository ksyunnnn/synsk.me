import {
  parseLifeEventInput,
  type LifeEventField,
  type LifeEventFieldError,
  type LifeEventFormValues,
  type LifeEventId,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';

export type EditLifeEventOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<LifeEventField, LifeEventFieldError>>;
      values: LifeEventFormValues;
    };

/**
 * life event を書き換える（FR-023・FR-024・FR-025・FR-035）。オーナーでなければ何も書かない（FR-031）。
 * 識別子が空なら今の識別子のまま。先に保存された画面の保存を止める要件は無い（research.md の R11）
 */
export const editLifeEvent = async (
  lifeEvents: LifeEventRepository,
  author: Author | null,
  id: LifeEventId,
  values: LifeEventFormValues,
): Promise<EditLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await lifeEvents.findForEdit(id);
  if (!current) return { status: 'not-found' };

  const parsed = parseLifeEventInput(values, current.slug);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };

  const result = await lifeEvents.edit(id, parsed.content);
  if (result.ok) return { status: 'saved' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', errors: { slug: 'slug-taken' }, values };
};
