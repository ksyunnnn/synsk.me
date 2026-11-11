import type { ExternalActivityRepository } from '@/features/activity/domain/activity-repository';
import {
  isManualSource,
  parseExternalActivityInput,
  toPublishedAt,
  type ExternalActivityContent,
  type ExternalActivityField,
  type ExternalActivityFieldError,
  type ExternalActivityFormValues,
  type ExternalActivityId,
} from '@/features/activity/domain/external-activity';
import type { UrlFetchedItem } from '@/features/activity/domain/fetched-item';
import type { OwnedSourceName } from '@/features/activity/domain/sources';
import type { Author } from '@/shared/domain/author';
import type { Uid } from '@/shared/domain/uid';

/**
 * URL を指名する取得元の 1 つの URL から題などを取る（src/features/activity/server/sources/ の
 * `fetchByUrl`）。項目が無いか題を読めなければ null、取得元の不調は投げる
 */
export type FetchByUrl = (source: OwnedSourceName, url: string) => Promise<UrlFetchedItem | null>;

export type RegisterExternalActivityOutcome =
  | { status: 'registered'; id: ExternalActivityId; uid: Uid }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<ExternalActivityField, ExternalActivityFieldError>>;
      values: ExternalActivityFormValues;
    };

/**
 * URL を指名した・手で入力した外部の activity を登録する（FR-005・FR-009〜FR-011）。オーナーで
 * なければ何も書かず、外へ要求も出さない（FR-031）。
 *
 * - 日付はオーナーが入れ、その日の UTC の 00:00 を公開日にする（U12 の (a)）。無ければ拒む（FR-011）
 * - 手で入力する取得元（CodePen・登録していないサイト）は、入れた URL・題をそのまま保存する（FR-010）
 * - URL を指名する取得元は、取得元から題などを取る（FR-009）。取得元が題を返さないか取れない
 *   ときは、オーナーが入れた題で保存する。題も入れていなければ拒む（U11 の (a)。URL から取った
 *   値を初期値にする形は #281）
 * - 同じ取得元に同じ URL が既にあれば拒む（FR-005・FR-008）
 */
export const registerExternalActivity = async (
  activities: ExternalActivityRepository,
  fetchByUrl: FetchByUrl,
  author: Author | null,
  values: ExternalActivityFormValues,
): Promise<RegisterExternalActivityOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = parseExternalActivityInput(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  const { source, url, title, publishedOn } = parsed.input;
  const invalid = (
    errors: Partial<Record<ExternalActivityField, ExternalActivityFieldError>>,
  ): RegisterExternalActivityOutcome => ({ status: 'invalid', errors, values });

  let content: ExternalActivityContent;
  if (isManualSource(source)) {
    content = { url, title: title ?? '', publishedAt: toPublishedAt(publishedOn), imageUrl: null };
  } else {
    let item: UrlFetchedItem | null;
    try {
      item = await fetchByUrl(source, url);
    } catch {
      return invalid({ url: 'fetch-failed' });
    }
    const savedTitle = item?.title ?? title;
    if (savedTitle === null) return invalid({ title: 'title-unavailable' });
    content = {
      url: item?.url ?? url,
      title: savedTitle,
      publishedAt: toPublishedAt(publishedOn),
      imageUrl: item?.imageUrl ?? null,
    };
  }

  const result = await activities.register(source, content);
  return result.ok
    ? { status: 'registered', id: result.id, uid: result.uid }
    : invalid({ url: 'url-taken' });
};
