/**
 * note の規則と、画面に渡す形。
 *
 * 規則の正本は specs/005-note-write-and-read/data-model.md にある。同じ規則を
 * `migrations/0001_create_note.sql` の制約も持つ。ここで先に確かめるのは、
 * どの項目の何が合わないかを作り手に返すため。
 */

export const SLUG_MAX_LENGTH = 100;
export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 100_000;

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export type NoteId = number;

/** URL やフォームから受け取った文字列を note の id にする。正の整数でなければ null */
export const parseNoteId = (value: string): NoteId | null => {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

/** 下書きか公開か。`note_publication` に行があれば公開 */
export type NoteStatus = 'draft' | 'published';

/** 作り手が入力する値 */
export type NoteContent = {
  slug: string;
  title: string;
  body: string;
};

export type NoteContentErrors = {
  slug?: 'missing' | 'invalid';
  title?: 'missing' | 'too-long';
  body?: 'too-long';
};

export type NoteContentValidation =
  { ok: true; content: NoteContent } | { ok: false; errors: NoteContentErrors };

/**
 * 文字数をコードポイントで数える。SQLite の `length()` と同じ数え方。
 * `value.length`（UTF-16 のコード単位）は絵文字1文字を2と数え、データベースの
 * 制約と食い違う
 */
const countCharacters = (value: string): number => [...value].length;

const toValidation = (content: NoteContent, errors: NoteContentErrors): NoteContentValidation =>
  Object.keys(errors).length === 0 ? { ok: true, content } : { ok: false, errors };

const collectDraftErrors = ({ slug, title, body }: NoteContent): NoteContentErrors => {
  const errors: NoteContentErrors = {};
  if (slug === '') {
    errors.slug = 'missing';
  } else if (countCharacters(slug) > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    errors.slug = 'invalid';
  }
  if (countCharacters(title) > TITLE_MAX_LENGTH) errors.title = 'too-long';
  if (countCharacters(body) > BODY_MAX_LENGTH) errors.body = 'too-long';
  return errors;
};

/** 保存できる入力か。題と本文は空でよい */
export const validateDraft = (content: NoteContent): NoteContentValidation =>
  toValidation(content, collectDraftErrors(content));

/** 公開できる入力か。保存の規則に加え、題が空でないこと */
export const validatePublication = (content: NoteContent): NoteContentValidation => {
  const errors = collectDraftErrors(content);
  if (content.title === '') errors.title = 'missing';
  return toValidation(content, errors);
};

const PUBLISHED_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `2026-09-16T15:30:00.000Z` の形の日時を、日本時間の日付 `2026-09-17` にする */
export const toPublishedDate = (isoDateTime: string): string => {
  const parts = PUBLISHED_DATE_FORMAT.formatToParts(new Date(isoDateTime));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

// ---------------------------------------------------------------------------
// 取り出した note。Repository が返す
// ---------------------------------------------------------------------------

/** 訪問者に見せている note。値はすべて `note_publication` のもの */
export type PublishedNote = {
  slug: string;
  title: string;
  body: string;
  /** 初めて公開した日時（UTC、`Date.prototype.toISOString()` の形） */
  firstPublishedAt: string;
};

/** 作り手の一覧の1件 */
export type NoteSummary = {
  id: NoteId;
  slug: string;
  /** 書き換えている題 */
  title: string;
  status: NoteStatus;
  /** 公開済みで、書き換えている題か本文が公開しているものと異なる */
  hasUnpublishedChanges: boolean;
};

/** 作り手が編集する note。値は書き換えているもの */
export type EditableNote = {
  id: NoteId;
  slug: string;
  title: string;
  body: string;
  status: NoteStatus;
};

// ---------------------------------------------------------------------------
// 画面に渡す形（DTO、ADR-0028）。出す項目を列挙して詰める
// ---------------------------------------------------------------------------

export type PublishedNoteDto = {
  slug: string;
  title: string;
  body: string;
  /** 公開日。日本時間の `YYYY-MM-DD` */
  publishedOn: string;
};

export type NoteSummaryDto = {
  id: NoteId;
  slug: string;
  title: string;
  status: NoteStatus;
  hasUnpublishedChanges: boolean;
};

export type EditableNoteDto = {
  id: NoteId;
  slug: string;
  title: string;
  body: string;
  status: NoteStatus;
};

export const toPublishedNoteDto = (note: PublishedNote): PublishedNoteDto => ({
  slug: note.slug,
  title: note.title,
  body: note.body,
  publishedOn: toPublishedDate(note.firstPublishedAt),
});

export const toNoteSummaryDto = (note: NoteSummary): NoteSummaryDto => ({
  id: note.id,
  slug: note.slug,
  title: note.title,
  status: note.status,
  hasUnpublishedChanges: note.hasUnpublishedChanges,
});

export const toEditableNoteDto = (note: EditableNote): EditableNoteDto => ({
  id: note.id,
  slug: note.slug,
  title: note.title,
  body: note.body,
  status: note.status,
});

/** 作る・編集のフォームに返す、操作の結果。入力の誤りは `errors` が持つ */
export type NoteFormResult =
  | 'saved'
  | 'published'
  | 'slug-taken'
  | 'slug-fixed'
  | 'not-found'
  | 'save-failed'
  | 'publish-failed'
  | 'forbidden';

/** 作る・編集のフォームの状態。入力した値を持ち、誤りや失敗のときも画面に残す */
export type NoteFormState = {
  values: NoteContent;
  errors: NoteContentErrors;
  result: NoteFormResult | null;
};

/** 操作の前のフォームの状態。値を省くと空の入力 */
export const toNoteFormState = (
  { slug, title, body }: NoteContent = { slug: '', title: '', body: '' },
): NoteFormState => ({ values: { slug, title, body }, errors: {}, result: null });
