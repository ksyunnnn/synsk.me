import type { ActionResult } from '@/shared/domain/action-result';
import { parseCalendarDate, type CalendarDate } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';
import { publishedAtToCalendarDate } from '@/features/activity/domain/date';
import {
  intakeModeOf,
  isRegisteredSource,
  parseRegisteredUrl,
  type ExternalSource,
  type ManualSource,
  type UrlSource,
} from '@/features/activity/domain/source';

/**
 * 外部の activity の型と、オーナーが管理画面で行う登録・書き換え・削除の決まり
 * （specs/004-external-activity/spec.md の FR-009〜FR-012・FR-021・FR-022・FR-031・FR-033、
 * research.md の R9）
 */

export type ActivityId = number;

/** 管理画面で出す外部の activity */
export type ExternalActivity = {
  id: ActivityId;
  /** 管理画面の URL とフォームで行を指す識別子 */
  uid: Uid;
  source: ExternalSource;
  externalId: string | null;
  url: string;
  title: string;
  /** 公開日時。URL を指名した・手で入力した activity は、オーナーが入れた日の日本時間の 0 時 */
  publishedAt: string;
  imageUrl: string | null;
  /** 初めて取り込んだ日時（FR-013） */
  createdAt: string;
};

/** 取得元ごとの最後の取得の結果（FR-016） */
export type FetchResult = {
  source: ExternalSource;
  fetchedAt: string;
  isOk: boolean;
  reason: string | null;
  lastSucceededAt: string | null;
};

/**
 * オーナーがその activity に行える操作。一覧を取る activity は書き換えも削除もできない
 * （FR-022）。URL を指名した activity は日付だけ、手で入力した activity は URL・題・日付を
 * 書き換えられる（FR-031）
 */
export const editableFieldsOf = (source: ExternalSource): readonly ActivityField[] => {
  const mode = intakeModeOf(source);
  if (mode === 'list') return [];
  return mode === 'url' ? ['publishedOn'] : ['url', 'title', 'publishedOn'];
};

/** 削除できるのは、URL を指名した activity と手で入力した activity だけ（FR-033、ADR-0052） */
export const canDelete = (source: ExternalSource): boolean => intakeModeOf(source) !== 'list';

/** 入力の項目の名前。フォームの値の名前と同じ */
export const ACTIVITY_FIELDS = ['source', 'url', 'title', 'publishedOn'] as const;
export type ActivityField = (typeof ACTIVITY_FIELDS)[number];

/** 編集と削除のフォームが、入力の項目とは別に送る値 */
export const ACTIVITY_UID_FIELD = 'activityUid';

export type ActivityFieldError =
  | 'missing'
  | 'invalid'
  /** URL がその取得元のものでない */
  | 'url-mismatch'
  /** 同じ取得元に同じ項目がある（FR-008） */
  | 'duplicate'
  /** 取得元から題を取れなかった（research.md の R9） */
  | 'fetch-failed'
  /** 一覧を取る activity は書き換えられない（FR-022） */
  | 'not-editable';

export type ActivityFormValues = Record<ActivityField, string>;
export type ActivityFormResult = ActionResult<ActivityField, ActivityFieldError>;

/** 登録する内容。題は手で入力する取得元だけが持ち、URL を指名する取得元は取得元から取る */
export type ActivityRegistration =
  | {
      mode: 'url';
      source: UrlSource;
      url: string;
      externalId: string | null;
      publishedOn: CalendarDate;
    }
  | {
      mode: 'manual';
      source: ManualSource;
      url: string;
      externalId: string | null;
      title: string;
      publishedOn: CalendarDate;
    };

type Errors = Partial<Record<ActivityField, ActivityFieldError>>;

/**
 * 登録のフォームの値を読む。取得元・URL・日付は必ず入れる（FR-011）。題は手で入力する取得元
 * だけが必ず入れ、URL を指名する取得元では読まない
 */
export const parseActivityRegistration = (
  values: ActivityFormValues,
): { ok: true; registration: ActivityRegistration } | { ok: false; errors: Errors } => {
  const errors: Errors = {};
  if (!isRegisteredSource(values.source)) {
    errors.source = 'invalid';
    return { ok: false, errors };
  }
  const source = values.source;
  const mode = intakeModeOf(source);

  const parsedUrl = values.url.trim() === '' ? null : parseRegisteredUrl(source, values.url);
  if (values.url.trim() === '') errors.url = 'missing';
  else if (parsedUrl === null) errors.url = 'url-mismatch';

  const publishedOn = parseCalendarDate(values.publishedOn.trim());
  if (values.publishedOn.trim() === '') errors.publishedOn = 'missing';
  else if (publishedOn === null) errors.publishedOn = 'invalid';

  const title = values.title.trim();
  if (mode === 'manual' && title === '') errors.title = 'missing';

  if (Object.keys(errors).length > 0 || parsedUrl === null || publishedOn === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    registration:
      mode === 'url'
        ? { mode: 'url', source: source as UrlSource, ...parsedUrl, publishedOn }
        : { mode: 'manual', source: source as ManualSource, ...parsedUrl, title, publishedOn },
  };
};

/** 書き換える内容。URL を指名した activity は日付だけを書き換える（FR-012） */
export type ActivityEdit = {
  url: string;
  externalId: string | null;
  title: string;
  publishedOn: CalendarDate;
};

/**
 * 書き換えのフォームの値を読む。書き換えられない項目は今の値のまま使い、送られた値を読まない
 * （FR-022・FR-031）
 */
export const parseActivityEdit = (
  current: ExternalActivity,
  values: ActivityFormValues,
): { ok: true; edit: ActivityEdit } | { ok: false; errors: Errors } => {
  const editable = editableFieldsOf(current.source);
  if (editable.length === 0) return { ok: false, errors: { source: 'not-editable' } };
  const errors: Errors = {};

  let url = current.url;
  let externalId = current.externalId;
  if (editable.includes('url') && isRegisteredSource(current.source)) {
    const parsed = values.url.trim() === '' ? null : parseRegisteredUrl(current.source, values.url);
    if (values.url.trim() === '') errors.url = 'missing';
    else if (parsed === null) errors.url = 'url-mismatch';
    else ({ url, externalId } = parsed);
  }

  let title = current.title;
  if (editable.includes('title')) {
    title = values.title.trim();
    if (title === '') errors.title = 'missing';
  }

  const publishedOn = parseCalendarDate(values.publishedOn.trim());
  if (values.publishedOn.trim() === '') errors.publishedOn = 'missing';
  else if (publishedOn === null) errors.publishedOn = 'invalid';

  if (Object.keys(errors).length > 0 || publishedOn === null) return { ok: false, errors };
  return { ok: true, edit: { url, externalId, title, publishedOn } };
};

/** フォームの初めの値。登録の画面は空で、取得元は URL を指名する取得元の先頭 */
export const toActivityFormValues = (activity?: ExternalActivity): ActivityFormValues =>
  activity
    ? {
        source: activity.source,
        url: activity.url,
        title: activity.title,
        publishedOn: publishedAtToCalendarDate(activity.publishedAt),
      }
    : { source: 'x_post', url: '', title: '', publishedOn: '' };
