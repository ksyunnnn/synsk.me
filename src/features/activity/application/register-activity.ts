import {
  parseActivityRegistration,
  type ActivityField,
  type ActivityFieldError,
  type ActivityFormValues,
  type ActivityId,
} from '@/features/activity/domain/activity';
import { calendarDateToPublishedAt } from '@/features/activity/domain/date';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';
import type { ActivityDeps } from './deps';

export type RegisterActivityOutcome =
  | { status: 'registered'; id: ActivityId; uid: Uid }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<ActivityField, ActivityFieldError>>;
      values: ActivityFormValues;
    };

/**
 * URL を指名して、または手で入力して、外部の activity を登録する（FR-009〜FR-011）。
 * オーナーでなければ、外へ要求を出さず、何も書かない（FR-031）。
 *
 * URL を指名する取得元は、取得元から題と代表の画像を 1 回だけ取る。取れなければ保存しない
 * （research.md の R9）。日付はオーナーが入れた値を使い、取得元の値で上書きしない（FR-012）
 */
export const registerActivity = async (
  { activities, fetchRegistered }: Pick<ActivityDeps, 'activities' | 'fetchRegistered'>,
  author: Author | null,
  values: ActivityFormValues,
): Promise<RegisterActivityOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = parseActivityRegistration(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const { registration } = parsed;

  let title: string;
  let imageUrl: string | null = null;
  if (registration.mode === 'url') {
    const fetched = await fetchRegistered(registration.source, registration.url);
    if (!fetched.ok) return { status: 'invalid', errors: { url: 'fetch-failed' }, values };
    ({ title, imageUrl } = fetched);
  } else {
    title = registration.title;
  }

  const result = await activities.register(registration.source, {
    externalId: registration.externalId,
    url: registration.url,
    title,
    imageUrl,
    publishedAt: calendarDateToPublishedAt(registration.publishedOn),
  });
  if (!result.ok) return { status: 'invalid', errors: { url: 'duplicate' }, values };
  return { status: 'registered', id: result.id, uid: result.uid };
};
