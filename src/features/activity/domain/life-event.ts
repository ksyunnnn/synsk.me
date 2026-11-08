import type { ActionResult } from '@/shared/domain/action-result';
import { emptyToNull } from '@/shared/domain/empty-to-null';
import { parseCalendarDate, type CalendarDate } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';

/**
 * life event の型と決まり（specs/004-external-activity/spec.md の FR-023〜FR-027・FR-034・
 * FR-035、research.md の R10）。life event は `activity` の `source = 'life_event'` の行
 */

export type LifeEventId = number;

/** オーナーが編集する life event */
export type LifeEvent = {
  id: LifeEventId;
  /** 管理画面の URL とフォームで行を指す識別子。訪問者向けの URL は slug */
  uid: Uid;
  slug: string;
  title: string;
  /** 説明。書式を持たない文章（research.md の R10） */
  description: string | null;
  happenedOn: CalendarDate;
};

/** オーナーの一覧の 1 行 */
export type LifeEventSummary = Pick<LifeEvent, 'id' | 'uid' | 'slug' | 'title' | 'happenedOn'>;

/**
 * 訪問者向けの DTO（contracts/visitor-life-event.md）。出してよい値だけを持つ。`id`・`uid` を
 * 持たない
 */
export type VisitorLifeEvent = {
  slug: string;
  title: string;
  happenedOn: CalendarDate;
  description: string | null;
};

/** 保存する内容。リンク先を持たない（FR-024） */
export type LifeEventContent = {
  title: string;
  description: string | null;
  happenedOn: CalendarDate;
};

export const LIFE_EVENT_FIELDS = ['title', 'description', 'happenedOn', 'slug'] as const;
export type LifeEventField = (typeof LIFE_EVENT_FIELDS)[number];

/** 編集と削除のフォームが、入力の項目とは別に送る値 */
export const LIFE_EVENT_UID_FIELD = 'lifeEventUid';

export type LifeEventFieldError = 'missing' | 'invalid' | 'slug-taken';
export type LifeEventFormValues = Record<LifeEventField, string>;
export type LifeEventFormResult = ActionResult<LifeEventField, LifeEventFieldError>;

/** 識別子の形（FR-035、migrations/0009 の CHECK）。1〜100 文字の英小文字・数字・ハイフン */
export const isLifeEventSlug = (value: string): boolean => /^[a-z0-9-]{1,100}$/.test(value);

/**
 * 作るときの識別子（FR-035）。題や起きた日から推測できない uid で、36 文字の英小文字（16 進）・
 * 数字・ハイフンのため `isLifeEventSlug` を満たす。001 の実績の識別子と同じ作り方
 */
export const newLifeEventSlug = (): string => crypto.randomUUID();

/**
 * フォームの値を保存する内容に読み替える。題と起きた日は必ず入れる（FR-025、research.md の
 * R10）。識別子はここで読まない
 */
export const parseLifeEventContent = (
  values: LifeEventFormValues,
):
  | { ok: true; content: LifeEventContent }
  | { ok: false; errors: Partial<Record<LifeEventField, LifeEventFieldError>> } => {
  const errors: Partial<Record<LifeEventField, LifeEventFieldError>> = {};
  const title = values.title.trim();
  if (title === '') errors.title = 'missing';
  const happenedOn = parseCalendarDate(values.happenedOn.trim());
  if (values.happenedOn.trim() === '') errors.happenedOn = 'missing';
  else if (happenedOn === null) errors.happenedOn = 'invalid';

  if (Object.keys(errors).length > 0 || happenedOn === null) return { ok: false, errors };
  return {
    ok: true,
    content: {
      title,
      description: emptyToNull(values.description.replace(/\r\n?/g, '\n')),
      happenedOn,
    },
  };
};

/** 編集で送られた識別子を確かめる。オーナーは書き換えられる（FR-035） */
export const parseLifeEventSlug = (
  value: string,
): { ok: true; slug: string } | { ok: false; error: LifeEventFieldError } => {
  const slug = value.trim();
  if (slug === '') return { ok: false, error: 'missing' };
  return isLifeEventSlug(slug) ? { ok: true, slug } : { ok: false, error: 'invalid' };
};

/** フォームの初めの値。作成の画面は空 */
export const toLifeEventFormValues = (event?: LifeEvent): LifeEventFormValues =>
  event
    ? {
        title: event.title,
        description: event.description ?? '',
        happenedOn: event.happenedOn,
        slug: event.slug,
      }
    : { title: '', description: '', happenedOn: '', slug: '' };

/** 説明を段落に分ける。空行で区切る（research.md の R10） */
export const paragraphsOf = (description: string | null): string[] =>
  (description ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
