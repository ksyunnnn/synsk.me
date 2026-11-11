import type { ActionResult } from '@/shared/domain/action-result';
import { parseCalendarDate, type CalendarDate } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';
import { normalizeWebUrl } from '@/shared/domain/web-url';
import {
  isHostOf,
  isOwnedSourceName,
  SOURCES,
  type OwnedSourceName,
} from '@/features/activity/domain/sources';

/**
 * オーナーが管理画面で登録・編集・削除する外部の activity（URL を指名した・手で入力した activity。
 * specs/004-external-activity/spec.md の FR-009〜FR-011・FR-022・FR-031・FR-033、contracts/dash.md）。
 * 一覧を取る取得元の activity と life event はこの型で扱わない
 */

export type ExternalActivityId = number;

export type ExternalActivity = {
  id: ExternalActivityId;
  /** 管理画面の URL とフォームで activity を指す識別子。画面に主キーを出さない（ADR-0051） */
  uid: Uid;
  source: OwnedSourceName;
  url: string;
  title: string;
  /** オーナーが入れた暦の日付。`published_at` の UTC の日付（U12 の (a)） */
  publishedOn: CalendarDate;
};

/** 保存する内容。`publishedAt` はオーナーが入れた日付の UTC の 00:00 */
export type ExternalActivityContent = {
  url: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
};

/** オーナーが入れた暦の日付を、その日の UTC の 00:00 にする（plan.md の U12 の (a)、research.md の R10） */
export const toPublishedAt = (date: CalendarDate): string => `${date}T00:00:00.000Z`;

/** `published_at` の UTC の日付。オーナーが入れた日付のまま読める（U12 の (a)） */
export const toPublishedOn = (publishedAt: string): CalendarDate =>
  publishedAt.slice(0, 10) as CalendarDate;

/** 手で入力する取得元か。URL と題をオーナーが入れ、編集でも書き換えられる（FR-010） */
export const isManualSource = (source: OwnedSourceName) => SOURCES[source].intake === 'manual';

/** 管理画面に出す取得元の名前 */
export const OWNED_SOURCE_LABELS: Record<OwnedSourceName, string> = {
  spotify: 'Spotify',
  x: 'X',
  codesandbox: 'CodeSandbox',
  youtube: 'YouTube',
  codepen: 'CodePen',
  unlisted: '登録していないサイト',
};

export const EXTERNAL_ACTIVITY_FIELDS = ['source', 'url', 'title', 'publishedOn'] as const;
export type ExternalActivityField = (typeof EXTERNAL_ACTIVITY_FIELDS)[number];
export type ExternalActivityFieldError =
  /** 入力が無い */
  | 'missing'
  /** 形が違う */
  | 'invalid'
  /** URL のホストが取得元と違う（R10） */
  | 'wrong-host'
  /** 同じ取得元に同じ URL が既にある（FR-005・FR-008） */
  | 'url-taken'
  /** 取得元から題を取れず、オーナーも題を入れていない（U11 の (a)） */
  | 'title-unavailable'
  /** 取得元の不調で題を取れなかった */
  | 'fetch-failed';
export type ExternalActivityFormValues = Record<ExternalActivityField, string>;
export type ExternalActivityFormResult = ActionResult<
  ExternalActivityField,
  ExternalActivityFieldError
>;

export const EXTERNAL_ACTIVITY_UID_FIELD = 'activityUid';

type Errors = Partial<Record<ExternalActivityField, ExternalActivityFieldError>>;

/** 取得元・URL・日付と、入れてあれば題。題が必須か（手で入力する取得元）は呼び手が決める */
export type ParsedExternalActivityInput = {
  source: OwnedSourceName;
  url: string;
  /** 空なら null */
  title: string | null;
  publishedOn: CalendarDate;
};

/**
 * 登録のフォームの値を読む。取得元は URL を指名する・手で入力する取得元だけを通し、一覧を取る
 * 取得元を拒む（FR-022）。日付は必須（FR-011）。URL は http か https で、URL を指名する取得元では
 * そのホストだけを通す（R10）。手で入力する取得元では題も必須（FR-010）
 */
export const parseExternalActivityInput = (
  values: ExternalActivityFormValues,
  fixedSource?: OwnedSourceName,
): { ok: true; input: ParsedExternalActivityInput } | { ok: false; errors: Errors } => {
  const errors: Errors = {};
  const sourceValue = fixedSource ?? values.source.trim();
  const source = isOwnedSourceName(sourceValue) ? sourceValue : null;
  if (source === null) errors.source = sourceValue === '' ? 'missing' : 'invalid';

  const rawUrl = values.url.trim();
  const url = normalizeWebUrl(rawUrl);
  if (rawUrl === '') errors.url = 'missing';
  else if (url === null) errors.url = 'invalid';
  else if (source !== null && !isHostOf(source, url)) errors.url = 'wrong-host';

  const title = values.title.trim();
  if (source !== null && isManualSource(source) && title === '') errors.title = 'missing';

  const rawDate = values.publishedOn.trim();
  const publishedOn = parseCalendarDate(rawDate);
  if (publishedOn === null) errors.publishedOn = rawDate === '' ? 'missing' : 'invalid';

  if (source === null || url === null || publishedOn === null || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, input: { source, url, title: title === '' ? null : title, publishedOn } };
};

export const toExternalActivityFormValues = (
  activity?: ExternalActivity,
): ExternalActivityFormValues => ({
  source: activity?.source ?? '',
  url: activity?.url ?? '',
  title: activity?.title ?? '',
  publishedOn: activity?.publishedOn ?? '',
});
