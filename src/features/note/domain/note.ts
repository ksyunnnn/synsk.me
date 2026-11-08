import type { ActionResult } from '@/shared/domain/action-result';
import type { Uid } from '@/shared/domain/uid';

/**
 * note の型と決まり（specs/003-note/spec.md の FR-001〜FR-016、data-model.md の
 * 「アプリケーションが守る決まり」）。
 */

export type NoteId = number;

/** note の状態（FR-010）。`note.status` の CHECK と同じ値を、ここ 1 か所に置く */
export const NOTE_STATUSES = ['draft', 'published'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  draft: '下書き',
  published: '公開',
};

/** 代表画像の出どころ（FR-024）。`note.card_image` の CHECK と同じ値 */
export const CARD_IMAGE_SOURCES = ['generated', 'media', 'site'] as const;
export type CardImageSource = (typeof CARD_IMAGE_SOURCES)[number];

export const CARD_IMAGE_SOURCE_LABELS: Record<CardImageSource, string> = {
  generated: '題を入れて自動で作る画像',
  media: 'この note の画像',
  site: 'サイト共通の画像',
};

export const isCardImageSource = (value: string): value is CardImageSource =>
  (CARD_IMAGE_SOURCES as readonly string[]).includes(value);

/** 題と本文の文字数の上限（FR-005）。`note_revision` の CHECK と同じ値 */
export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 100_000;

/**
 * 文字数。D1 の `length()` と同じく、コードポイントの数を数える（`note_revision` の CHECK と
 * 数え方を揃える）
 */
export const countCharacters = (value: string): number => [...value].length;

/** 識別子の形（FR-002、`note.slug` の CHECK）。1〜100 文字の英小文字・数字・ハイフン */
export const isNoteSlug = (value: string): boolean => /^[a-z0-9-]{1,100}$/.test(value);

/**
 * 版の番号。その note の版を古い順に 1 から数えた値（research.md の R4）。主キーの版の id は
 * 画面に出さない
 */
export type RevisionNumber = number;

/** 文字列の版の番号を読む。正の整数でなければ null */
export const parseRevisionNumber = (value: string): RevisionNumber | null =>
  /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null;

/** 版の中身（FR-005） */
export type NoteContent = {
  title: string;
  /** 説明文。空なら null */
  description: string | null;
  body: string;
};

/** 版（FR-006・FR-008） */
export type NoteRevision = NoteContent & {
  number: RevisionNumber;
  createdAt: string;
};

/** note の画像。`file` は本文の `media:{file}` と URL に使うファイル名（research.md の R7） */
export type NoteImage = { file: string };

/** オーナーが編集する note */
export type NoteForEdit = {
  id: NoteId;
  /** 管理画面の URL とフォームで note を指す識別子（research.md の R1） */
  uid: Uid;
  slug: string;
  status: NoteStatus;
  isDeleted: boolean;
  /** 初めて公開した日時。一度も公開していなければ null（FR-013） */
  publishedAt: string | null;
  /** 公開した版の番号。一度も公開していなければ null */
  publishedRevisionNumber: RevisionNumber | null;
  /** 最新の版。オーナーが書き換える内容はここから始まる（FR-007） */
  latest: NoteRevision;
  cardImage: { source: CardImageSource; file: string | null };
  images: NoteImage[];
  /** 転載先の URL（FR-031） */
  syndications: string[];
};

/** オーナーの一覧の 1 行 */
export type NoteSummary = {
  id: NoteId;
  uid: Uid;
  slug: string;
  /** 最新の版の題 */
  title: string;
  status: NoteStatus;
  isDeleted: boolean;
  latestRevisionNumber: RevisionNumber;
  publishedRevisionNumber: RevisionNumber | null;
};

/** 入力の項目の名前。フォームの値の名前と同じ */
export const NOTE_FIELDS = ['slug', 'title', 'description', 'body'] as const;
export type NoteField = (typeof NOTE_FIELDS)[number];
export type NoteFormValues = Record<NoteField, string>;

/** 編集の画面のフォームが、入力の項目とは別に送る値 */
export const NOTE_UID_FIELD = 'noteUid';
export const OPENED_REVISION_FIELD = 'openedRevision';
/** 過去の版に戻すフォームが、戻す版の番号を送る名前 */
export const RESTORE_REVISION_FIELD = 'restoreRevision';

export type NoteFieldError =
  | 'missing'
  | 'invalid'
  | 'too-long'
  | 'slug-taken'
  /** 一度でも公開した note の識別子は変えられない（FR-003） */
  | 'slug-locked';

/** 作る・保存するフォームの結果。削除した note は、戻すまで保存しない（research.md の R5） */
export type NoteFormResult =
  ActionResult<NoteField, NoteFieldError> | { status: 'deleted'; values: Partial<NoteFormValues> };

/** 状態を変える操作の結果。成功したときは別の画面へ移すため、返すのは止めたときだけ */
export type NoteOperationResult = { status: string };

/** 操作の名前。成功した後の画面に `?done=` で渡し、知らせの文言を選ぶ */
export type NoteDoneKind =
  | 'created'
  | 'published'
  | 'unpublished'
  | 'undeleted'
  | 'restored'
  | 'image-added'
  | 'card-image'
  | 'syndication-added'
  | 'syndication-removed'
  | 'refreshed';

/** 改行を `\n` に揃える。ブラウザは `<textarea>` の改行を `\r\n` で送る */
const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, '\n');

/**
 * フォームの値を保存する内容と識別子に読み替える。題は空でも保存できる（下書きのうちは空で
 * よい。spec の Edge Cases）。公開できるかは公開の操作で確かめる
 */
export const parseNoteForm = (
  values: NoteFormValues,
):
  | { ok: true; slug: string; content: NoteContent }
  | { ok: false; errors: Partial<Record<NoteField, NoteFieldError>> } => {
  const errors: Partial<Record<NoteField, NoteFieldError>> = {};
  const slug = values.slug.trim();
  if (slug === '') errors.slug = 'missing';
  else if (!isNoteSlug(slug)) errors.slug = 'invalid';

  const title = values.title.trim();
  if (countCharacters(title) > NOTE_TITLE_MAX) errors.title = 'too-long';
  const body = normalizeNewlines(values.body);
  if (countCharacters(body) > NOTE_BODY_MAX) errors.body = 'too-long';
  const description = normalizeNewlines(values.description).trim();

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    slug,
    content: { title, description: description === '' ? null : description, body },
  };
};

/** フォームの初めの値。作る画面は空 */
export const toNoteFormValues = (note?: Pick<NoteForEdit, 'slug' | 'latest'>): NoteFormValues =>
  note
    ? {
        slug: note.slug,
        title: note.latest.title,
        description: note.latest.description ?? '',
        body: note.latest.body,
      }
    : { slug: '', title: '', description: '', body: '' };

/*
 * 訪問者向けの DTO（contracts/visitor-note.md）。Repository の実装が、公開で削除していない
 * note の公開した版の列だけを読んで詰める。画面・`<title>`・OGP はこの値だけを使う
 */

/** 参照先の情報（FR-027〜FR-030）。取れた URL だけを持つ */
export type LinkPreview = { url: string; title: string | null; imageUrl: string | null };

export type VisitorNote = {
  slug: string;
  title: string;
  description: string | null;
  body: string;
  /** 初めて公開した日時（FR-013） */
  publishedAt: string;
  cardImage: { source: CardImageSource; file: string | null };
  /** 本文のカードにする URL の参照先の情報。URL をキーにする */
  linkPreviews: Record<string, LinkPreview>;
};

/** カードの説明の文字数。説明文が空の note は、本文の冒頭をこの長さで使う（docs/CRAWLING.md） */
const CARD_DESCRIPTION_MAX = 120;

/**
 * 他のサービスに貼られたときのカードの説明（docs/CRAWLING.md）。説明文があればそれを、
 * 無ければ本文の冒頭から Markdown の記号と画像の印を落とした文を使う。本文も空なら null
 */
export const toCardDescription = ({
  description,
  body,
}: Pick<VisitorNote, 'description' | 'body'>): string | null => {
  if (description) return description;
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 行頭の見出し・引用・並びの印と、強調とコードの記号だけを落とす。URL の中のハイフンは残す
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '') return null;
  const chars = [...text];
  return chars.length > CARD_DESCRIPTION_MAX
    ? `${chars.slice(0, CARD_DESCRIPTION_MAX).join('')}…`
    : text;
};
