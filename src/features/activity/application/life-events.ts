import {
  newLifeEventSlug,
  parseLifeEventContent,
  parseLifeEventSlug,
  type LifeEvent,
  type LifeEventField,
  type LifeEventFieldError,
  type LifeEventFormValues,
  type LifeEventId,
  type LifeEventSummary,
  type VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

/**
 * life event のユースケース（specs/004-external-activity/spec.md の User Story 5）。書き込みは
 * オーナーでなければ何も書かない（FR-031）
 */

type Invalid = {
  status: 'invalid';
  errors: Partial<Record<LifeEventField, LifeEventFieldError>>;
  values: LifeEventFormValues;
};

export type RegisterLifeEventOutcome =
  { status: 'registered'; id: LifeEventId; uid: Uid } | { status: 'forbidden' } | Invalid;

/** life event を作る。識別子は推測できない uid にする（FR-035） */
export const registerLifeEvent = async (
  lifeEvents: LifeEventRepository,
  author: Author | null,
  values: LifeEventFormValues,
): Promise<RegisterLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseLifeEventContent(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const result = await lifeEvents.register({ ...parsed.content, slug: newLifeEventSlug() });
  return result.ok
    ? { status: 'registered', id: result.id, uid: result.uid }
    : { status: 'invalid', errors: { slug: 'slug-taken' }, values };
};

export type EditLifeEventOutcome =
  { status: 'saved' } | { status: 'forbidden' } | { status: 'not-found' } | Invalid;

/** life event を書き換える。識別子もオーナーが書き換えられ、重なれば拒む（FR-035） */
export const editLifeEvent = async (
  lifeEvents: LifeEventRepository,
  author: Author | null,
  id: LifeEventId,
  values: LifeEventFormValues,
): Promise<EditLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseLifeEventContent(values);
  const slug = parseLifeEventSlug(values.slug);
  if (!parsed.ok || !slug.ok) {
    return {
      status: 'invalid',
      errors: { ...(parsed.ok ? {} : parsed.errors), ...(slug.ok ? {} : { slug: slug.error }) },
      values,
    };
  }
  const result = await lifeEvents.edit(id, { ...parsed.content, slug: slug.slug });
  if (result.ok) return { status: 'saved' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', errors: { slug: 'slug-taken' }, values };
};

export type DeleteLifeEventOutcome =
  { status: 'deleted' } | { status: 'forbidden' } | { status: 'not-found' };

/** life event と、その画像の記録を消す（FR-027） */
export const deleteLifeEvent = async (
  lifeEvents: LifeEventRepository,
  author: Author | null,
  id: LifeEventId,
): Promise<DeleteLifeEventOutcome> => {
  if (!author) return { status: 'forbidden' };
  return (await lifeEvents.delete(id)).ok ? { status: 'deleted' } : { status: 'not-found' };
};

export const listLifeEvents = (lifeEvents: LifeEventRepository): Promise<LifeEventSummary[]> =>
  lifeEvents.list();

export const getLifeEventForEdit = (
  lifeEvents: LifeEventRepository,
  id: LifeEventId,
): Promise<LifeEvent | null> => lifeEvents.findForEdit(id);

/** 訪問者に見せる life event（FR-034）。無い識別子なら null */
export const getVisitorLifeEvent = (
  lifeEvents: LifeEventRepository,
  slug: string,
): Promise<VisitorLifeEvent | null> => lifeEvents.findVisitorBySlug(slug);
