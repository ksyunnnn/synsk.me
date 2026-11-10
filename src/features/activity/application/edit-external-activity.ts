import type { ExternalActivityRepository } from '@/features/activity/domain/activity-repository';
import {
  isManualSource,
  parseExternalActivityInput,
  toPublishedAt,
  type ExternalActivityField,
  type ExternalActivityFieldError,
  type ExternalActivityFormValues,
  type ExternalActivityId,
} from '@/features/activity/domain/external-activity';
import type { Author } from '@/shared/domain/author';

export type EditExternalActivityOutcome =
  | { status: 'saved' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | {
      status: 'invalid';
      errors: Partial<Record<ExternalActivityField, ExternalActivityFieldError>>;
      values: ExternalActivityFormValues;
    };

/**
 * URL を指名した・手で入力した外部の activity を書き換える（contracts/dash.md）。日付を書き換え、
 * 手で入力する取得元では URL と題も書き換える。取得元は変えない。オーナーでなければ何も書かない
 * （FR-031）。一覧を取る取得元の activity と life event は Repository が見つけない（FR-022）
 */
export const editExternalActivity = async (
  activities: ExternalActivityRepository,
  author: Author | null,
  id: ExternalActivityId,
  values: ExternalActivityFormValues,
): Promise<EditExternalActivityOutcome> => {
  if (!author) return { status: 'forbidden' };

  const current = await activities.findForEdit(id);
  if (!current) return { status: 'not-found' };

  const manual = isManualSource(current.source);
  // URL を指名する取得元の URL と題は取得元が決めたので、送られた値を読まない
  const submitted = manual
    ? { ...values, source: current.source }
    : { ...values, source: current.source, url: current.url, title: current.title };
  const parsed = parseExternalActivityInput(submitted, current.source);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values: submitted };

  const publishedAt = toPublishedAt(parsed.input.publishedOn);
  const result = await activities.edit(
    id,
    manual
      ? { publishedAt, url: parsed.input.url, title: parsed.input.title ?? '' }
      : { publishedAt },
  );
  if (result.ok) return { status: 'saved' };
  return result.reason === 'not-found'
    ? { status: 'not-found' }
    : { status: 'invalid', errors: { url: 'url-taken' }, values: submitted };
};
