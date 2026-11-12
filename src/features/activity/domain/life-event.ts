import type { ActionResult } from '@/shared/domain/action-result';
import { emptyToNull } from '@/shared/domain/empty-to-null';
import type { MediaRejection } from '@/shared/domain/media';
import { normalizeNewlines } from '@/shared/domain/newlines';
import { parseCalendarDate, type CalendarDate } from '@/shared/domain/period';
import { isSlug, newSlug } from '@/shared/domain/slug';
import type { Uid } from '@/shared/domain/uid';
import { routes } from '@/shared/routes';

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
  title: string;
  description: string | null;
  happenedOn: CalendarDate;
  /** 代表画像を配る経路の URL。無ければ null（FR-028） */
  cardImageUrl: string | null;
};

export type LifeEventSummary = Pick<LifeEvent, 'id' | 'uid' | 'slug' | 'title' | 'happenedOn'>;

/** 保存する内容 */
export type LifeEventContent = {
  title: string;
  description: string | null;
  happenedOn: CalendarDate;
};

/**
 * 訪問者に見せる life event（specs/004-external-activity/contracts/visitor-life-event.md）。
 * `id`・`uid`・`created_at`・`updated_at` を含めない（constitution の Allowlist Visibility）
 */
export type VisitorLifeEvent = {
  slug: string;
  title: string;
  description: string | null;
  happenedOn: CalendarDate;
  /** 代表画像を配る経路の URL。無ければ null */
  cardImageUrl: string | null;
};

/** 代表画像を配る経路（contracts/visitor-life-event.md の「画像の経路」）。値は `media.storage_key` */
export const lifeEventImagePath = (slug: string, storageKey: string) =>
  routes.lifeEventMedia(slug, storageKey);

export const LIFE_EVENT_IMAGE_FIELD = 'image';

export const LIFE_EVENT_FIELDS = ['title', 'description', 'happenedOn', 'slug'] as const;
export type LifeEventField = (typeof LIFE_EVENT_FIELDS)[number];
export type LifeEventFieldError = 'missing' | 'invalid' | 'slug-taken';
export type LifeEventFormValues = Record<LifeEventField, string>;
export type LifeEventFormResult = ActionResult<LifeEventField, LifeEventFieldError>;

export const LIFE_EVENT_UID_FIELD = 'lifeEventUid';

/** フォームの値を保存する内容に読み替える。題（FR-024）と起きた日（FR-025）は必須 */
export const parseLifeEventContent = (
  values: LifeEventFormValues,
):
  | { ok: true; content: LifeEventContent }
  | { ok: false; errors: Partial<Record<LifeEventField, LifeEventFieldError>> } => {
  const errors: Partial<Record<LifeEventField, LifeEventFieldError>> = {};
  const title = values.title.trim();
  if (title === '') errors.title = 'missing';
  const happenedOn = parseCalendarDate(values.happenedOn.trim());
  if (happenedOn === null) {
    errors.happenedOn = values.happenedOn.trim() === '' ? 'missing' : 'invalid';
  }
  if (happenedOn === null || errors.title) return { ok: false, errors };
  return {
    ok: true,
    content: {
      title,
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

/**
 * 代表画像の操作の Server Action が返す結果。保存したら同じ画面へ移すので、画面に返すのは
 * 保存しなかったときだけ
 */
export type LifeEventImageResult =
  { status: 'forbidden' } | { status: 'rejected'; reason: MediaRejection };
