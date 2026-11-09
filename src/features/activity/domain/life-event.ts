import type { ActionResult } from '@/shared/domain/action-result';
import { emptyToNull } from '@/shared/domain/empty-to-null';
import { normalizeNewlines } from '@/shared/domain/newlines';
import { parseCalendarDate, type CalendarDate } from '@/shared/domain/period';
import { isSlug, newSlug } from '@/shared/domain/slug';
import type { Uid } from '@/shared/domain/uid';

/**
 * life event の型と決まり（specs/004-external-activity/spec.md の FR-023〜FR-026・FR-034・FR-035、
 * data-model.md）。life event は `activity` の `source = 'life_event'` の行で、リンク先を持たない
 * （FR-024）
 */

export type LifeEventId = number;

/** オーナーが編集する life event */
export type LifeEvent = {
  id: LifeEventId;
  /** 管理画面の URL とフォームで life event を指す識別子。画面に主キーを出さない */
  uid: Uid;
  /** 訪問者向けの URL の識別子（FR-035） */
  slug: string;
  title: string | null;
  description: string | null;
  happenedOn: CalendarDate;
};

export type LifeEventSummary = Pick<LifeEvent, 'id' | 'uid' | 'slug' | 'title' | 'happenedOn'>;

/** 保存する内容 */
export type LifeEventContent = {
  title: string | null;
  description: string | null;
  happenedOn: CalendarDate;
};

/**
 * 訪問者に見せる life event（specs/004-external-activity/contracts/visitor-life-event.md）。
 * `id`・`uid`・`created_at`・`updated_at` を含めない（constitution の Allowlist Visibility）
 */
export type VisitorLifeEvent = {
  slug: string;
  title: string | null;
  description: string | null;
  happenedOn: CalendarDate;
};

export const LIFE_EVENT_FIELDS = ['title', 'description', 'happenedOn', 'slug'] as const;
export type LifeEventField = (typeof LIFE_EVENT_FIELDS)[number];
export type LifeEventFieldError = 'missing' | 'invalid' | 'slug-taken';
export type LifeEventFormValues = Record<LifeEventField, string>;
export type LifeEventFormResult = ActionResult<LifeEventField, LifeEventFieldError>;

export const LIFE_EVENT_UID_FIELD = 'lifeEventUid';

/** フォームの値を保存する内容に読み替える。起きた日は必須（FR-025） */
export const parseLifeEventContent = (
  values: LifeEventFormValues,
):
  | { ok: true; content: LifeEventContent }
  | { ok: false; errors: Partial<Record<LifeEventField, LifeEventFieldError>> } => {
  const happenedOn = parseCalendarDate(values.happenedOn.trim());
  if (happenedOn === null) {
    return {
      ok: false,
      errors: { happenedOn: values.happenedOn.trim() === '' ? 'missing' : 'invalid' },
    };
  }
  return {
    ok: true,
    content: {
      title: emptyToNull(values.title)?.trim() ?? null,
      description: emptyToNull(normalizeNewlines(values.description)),
      happenedOn,
    },
  };
};

/**
 * 保存する識別子を決める（FR-035）。空なら、作るときは推測できない値を入れ、編集では今の値の
 * ままにする。形の違う値は拒む。重複は D1 の UNIQUE が拒む
 */
export const decideLifeEventSlug = (
  requested: string,
  current?: string,
): { ok: true; slug: string } | { ok: false } => {
  const slug = requested.trim();
  if (slug === '') return { ok: true, slug: current ?? newSlug() };
  return isSlug(slug) ? { ok: true, slug } : { ok: false };
};

export const toLifeEventFormValues = (lifeEvent?: LifeEvent): LifeEventFormValues => ({
  title: lifeEvent?.title ?? '',
  description: lifeEvent?.description ?? '',
  happenedOn: lifeEvent?.happenedOn ?? '',
  slug: lifeEvent?.slug ?? '',
});
