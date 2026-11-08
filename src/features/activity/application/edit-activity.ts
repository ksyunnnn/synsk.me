import {
  canDelete,
  parseActivityEdit,
  type ActivityField,
  type ActivityFieldError,
  type ActivityFormValues,
  type ActivityId,
  type ExternalActivity,
} from '@/features/activity/domain/activity';
import type { ActivityRepository } from '@/features/activity/domain/activity-repository';
import { calendarDateToPublishedAt } from '@/features/activity/domain/date';
import type { Author } from '@/shared/domain/author';

export type EditActivityOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<ActivityField, ActivityFieldError>>;
      values: ActivityFormValues;
    };

/**
 * URL を指名した activity の日付と、手で入力した activity の URL・題・日付を書き換える
 * （FR-031）。一覧を取る activity は書き換えない（FR-022）。オーナーでなければ何も書かない
 */
export const editActivity = async (
  activities: ActivityRepository,
  author: Author | null,
  id: ActivityId,
  values: ActivityFormValues,
): Promise<EditActivityOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await activities.findForEdit(id);
  if (!current) return { status: 'not-found' };

  const parsed = parseActivityEdit(current, values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const { edit } = parsed;

  const result = await activities.edit(id, {
    url: edit.url,
    externalId: edit.externalId,
    title: edit.title,
    publishedAt: calendarDateToPublishedAt(edit.publishedOn),
  });
  if (result.ok) return { status: 'saved' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', errors: { url: 'duplicate' }, values };
};

export type DeleteActivityOutcome =
  | { status: 'deleted' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'not-deletable' };

/**
 * URL を指名した activity と手で入力した activity を物理削除する（FR-033、ADR-0052）。
 * 一覧を取る activity は消さない（FR-022）。オーナーでなければ何も書かない
 */
export const deleteActivity = async (
  activities: ActivityRepository,
  author: Author | null,
  id: ActivityId,
): Promise<DeleteActivityOutcome> => {
  if (!author) return { status: 'forbidden' };
  const current: ExternalActivity | null = await activities.findForEdit(id);
  if (!current) return { status: 'not-found' };
  if (!canDelete(current.source)) return { status: 'not-deletable' };
  return (await activities.delete(id)).ok ? { status: 'deleted' } : { status: 'not-found' };
};
