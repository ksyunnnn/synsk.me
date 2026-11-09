import type { ActionResult } from '@/shared/domain/action-result';
import { emptyToNull } from '@/shared/domain/empty-to-null';
import {
  parseMediaStorageKey,
  type MediaRejection,
  type MediaStorageKey,
} from '@/shared/domain/media';
import { isSlug } from '@/shared/domain/slug';
import type { Uid } from '@/shared/domain/uid';

/**
 * note の型と決まり（specs/003-note/spec.md の FR-002・FR-003・FR-005・FR-010・FR-011、
 * data-model.md の「domain の型」と「アプリケーションが守る決まり」）
 */

/** note の状態（FR-010）。`note.status` の CHECK と同じ値を、ここ 1 か所に置く */
export const NOTE_STATUSES = ['draft', 'published'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  draft: '下書き',
  published: '公開',
};

/**
 * 代表画像の出どころ（FR-024）。`note.card_image` の CHECK と同じ値。`generated` は題を入れて
 * 自動で作る画像、`media` はその note の画像、`site` はサイト共通の画像
 */
export const NOTE_CARD_IMAGES = ['generated', 'media', 'site'] as const;
export type NoteCardImage = (typeof NOTE_CARD_IMAGES)[number];

export const isNoteCardImage = (value: string): value is NoteCardImage =>
  (NOTE_CARD_IMAGES as readonly string[]).includes(value);

/** 主キー。URL とフォームに出さない（ADR-0051） */
export type NoteId = number;
export type NoteRevisionId = number;

/** 題と本文の長さの上限（FR-005、`note_revision.title`・`body` の CHECK） */
export const NOTE_TITLE_MAX_LENGTH = 200;
export const NOTE_BODY_MAX_LENGTH = 100_000;

/** SQLite の `length()` と同じく、文字（コードポイント）の数で数える */
const lengthOf = (value: string) => [...value].length;

/** 版の中身 */
export type NoteRevisionContent = {
  title: string;
  /** 空なら null（FR-005） */
  description: string | null;
  body: string;
};

export type NoteRevision = NoteRevisionContent & {
  uid: Uid;
  /** 保存した日時 */
  createdAt: string;
};

/** オーナーが編集する note */
export type Note = {
  id: NoteId;
  uid: Uid;
  slug: string;
  status: NoteStatus;
  /** 初めて公開した日時。持てば一度でも公開した note（FR-003・FR-013） */
  publishedAt: string | null;
  /** 削除した日時。持てば削除した note（FR-016） */
  deletedAt: string | null;
  cardImage: NoteCardImage;
  /** 代表画像に選んだ note の画像。`cardImage` が `media` のときだけ持つ */
  cardMediaStorageKey: MediaStorageKey | null;
  /** 最も新しい版。編集はここから始まる（FR-007） */
  latestRevision: NoteRevision;
  /** 公開した版の uid。一度も公開していなければ null */
  publishedRevisionUid: Uid | null;
  /** その note の画像の置き場のキー。足した順 */
  mediaStorageKeys: MediaStorageKey[];
  /** 転載先の URL。記録した順（FR-031） */
  syndicationUrls: string[];
};

/** オーナーの一覧の 1 行 */
export type NoteSummary = {
  uid: Uid;
  slug: string;
  /** 最も新しい版の題 */
  title: string;
  status: NoteStatus;
  isDeleted: boolean;
  createdAt: string;
};

/** 版の一覧の 1 行（FR-008） */
export type NoteRevisionSummary = {
  uid: Uid;
  title: string;
  createdAt: string;
  isLatest: boolean;
  isPublished: boolean;
};

/** 一度でも公開した note か。`published_at` を持つことで表す（data-model.md の「状態の移り変わり」） */
export const hasBeenPublished = (note: Pick<Note, 'publishedAt'>): boolean =>
  note.publishedAt !== null;

/** 入力の項目の名前。フォームの値の名前と同じ */
export const NOTE_FIELDS = ['slug', 'title', 'description', 'body'] as const;
export type NoteField = (typeof NOTE_FIELDS)[number];

/** 編集の画面のフォームが、入力の項目とは別に送る値 */
export const NOTE_UID_FIELD = 'noteUid';
/** 開いたときの最も新しい版の uid（research.md の R4） */
export const OPENED_REVISION_UID_FIELD = 'openedRevisionUid';
/** 戻す版の uid（FR-009） */
export const REVISION_UID_FIELD = 'revisionUid';

export type NoteFieldError =
  | 'missing'
  | 'invalid'
  | 'too-long'
  | 'slug-taken'
  /** 一度でも公開した note の識別子を変えようとした（FR-003） */
  | 'slug-locked';

export type NoteFormValues = Record<NoteField, string>;
export type NoteFieldErrors = Partial<Record<NoteField, NoteFieldError>>;
export type NoteFormResult = ActionResult<NoteField, NoteFieldError>;

/** 過去の版に戻すフォームの結果。戻せたときは Server Action が編集の画面へ移す */
export type RevertNoteResult = { status: 'forbidden' } | { status: 'conflict' };

/**
 * 代表画像の入力の名前（FR-024・FR-025）。値は `generated`・`site`、その note の画像なら
 * `media:<storageKey>`。1 つのラジオボタンの並びで送る
 */
export const CARD_IMAGE_FIELD = 'cardImage';

const CARD_MEDIA_PREFIX = 'media:';

/** 代表画像の入力の値 */
export const toCardImageValue = (cardImage: VisitorNoteCardImage): string =>
  cardImage.kind === 'media' ? `${CARD_MEDIA_PREFIX}${cardImage.storageKey}` : cardImage.kind;

/** 代表画像の入力を読む。読めなければ null */
export const parseCardImageChoice = (value: string): VisitorNoteCardImage | null => {
  if (value.startsWith(CARD_MEDIA_PREFIX)) {
    const storageKey = parseMediaStorageKey(value.slice(CARD_MEDIA_PREFIX.length));
    return storageKey === null ? null : { kind: 'media', storageKey };
  }
  return value === 'generated' || value === 'site' ? { kind: value } : null;
};

/** 代表画像の誤り。`media-not-owned` は、その note の画像でない（FR-025） */
export type CardImageFormResult = ActionResult<
  typeof CARD_IMAGE_FIELD,
  'invalid' | 'media-not-owned'
>;

/** 画像のファイルの入力の名前（FR-023）。1 回の操作で 1 枚（research.md の R12） */
export const MEDIA_FILE_FIELD = 'mediaFile';

export type MediaFormResult = ActionResult<typeof MEDIA_FILE_FIELD, MediaRejection>;

/** 本文に貼る画像の印（research.md の R11）。代替テキストとキャプションはオーナーが書き換える */
export const mediaMarkOf = (storageKey: MediaStorageKey) =>
  `![代替テキスト](media:${storageKey} "キャプション")`;

/** 転載先の URL の入力の名前（FR-031）。外すフォームも同じ名前で URL を送る（research.md の R14） */
export const SYNDICATION_URL_FIELD = 'syndicationUrl';

/** 転載先の URL の誤り。`taken` は同じ URL がどれかの note に記録済み（FR-032） */
export type SyndicationFieldError = 'missing' | 'invalid' | 'taken';

export type SyndicationFormResult = ActionResult<
  typeof SYNDICATION_URL_FIELD,
  SyndicationFieldError
>;

/** 保存する内容 */
export type NoteInput = NoteRevisionContent & { slug: string };

/** 複数行の入力の改行を `\n` に揃える。`<textarea>` は `\r\n` で送る */
const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, '\n');

/**
 * フォームの値を保存する内容に読み替える。題は前後の空白を除き、空でもよい（下書きは題が空でも
 * 保存できる。公開は `checkPublishable` が止める）。説明文が空なら null（FR-005）
 */
export const parseNoteInput = (
  values: NoteFormValues,
): { ok: true; input: NoteInput } | { ok: false; errors: NoteFieldErrors } => {
  const errors: NoteFieldErrors = {};

  if (values.slug === '') errors.slug = 'missing';
  else if (!isSlug(values.slug)) errors.slug = 'invalid';

  const title = values.title.trim();
  if (lengthOf(title) > NOTE_TITLE_MAX_LENGTH) errors.title = 'too-long';

  const body = normalizeNewlines(values.body);
  if (lengthOf(body) > NOTE_BODY_MAX_LENGTH) errors.body = 'too-long';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      slug: values.slug,
      title,
      description: emptyToNull(normalizeNewlines(values.description)),
      body,
    },
  };
};

/**
 * 識別子の書き換えを確かめる（FR-003）。一度でも公開した note は、今の識別子と違う識別子を拒む。
 * トリガ `note_slug_fixed_after_publication` を最後の守りに残す
 */
export const checkSlugChange = (
  note: Pick<Note, 'slug' | 'publishedAt'>,
  requestedSlug: string,
): NoteFieldError | null =>
  hasBeenPublished(note) && requestedSlug !== note.slug ? 'slug-locked' : null;

/**
 * 版を公開できるか（FR-011）。題が空か空白だけの版は公開しない。トリガ
 * `note_published_revision_valid` を最後の守りに残す
 */
export const checkPublishable = (revision: Pick<NoteRevisionContent, 'title'>): NoteFieldErrors =>
  revision.title.trim() === '' ? { title: 'missing' } : {};

/** フォームの初めの値。作成の画面は空、編集の画面は最も新しい版（FR-007） */
export const toNoteFormValues = (note?: Pick<Note, 'slug' | 'latestRevision'>): NoteFormValues =>
  note
    ? {
        slug: note.slug,
        title: note.latestRevision.title,
        description: note.latestRevision.description ?? '',
        body: note.latestRevision.body,
      }
    : { slug: '', title: '', description: '', body: '' };

/*
 * 訪問者向けの DTO（contracts/visitor-note.md）。Repository の実装が、公開で削除していない
 * note の公開した版だけを読んで詰める。画面・`<title>`・OGP はこの値だけを使う
 */

/** 代表画像。`generated` の画像の作り方は plan.md の U8 */
export type VisitorNoteCardImage =
  { kind: 'generated' } | { kind: 'site' } | { kind: 'media'; storageKey: MediaStorageKey };

/** URL だけの段落が指す参照先の情報（FR-029・FR-030）。カードの出し方は plan.md の U9 */
export type VisitorLinkPreview = {
  url: string;
  title: string | null;
  imageUrl: string | null;
};

export type VisitorNote = {
  slug: string;
  title: string;
  /** 公開した版の説明文。空なら null */
  description: string | null;
  /**
   * `<meta name="description">` と OGP の説明。説明文が空なら本文の最初の段落の文字列で、どちらも
   * 無ければ null（research.md の R11）。最初の段落に書いた生の HTML の文字は除かずに文字のまま
   * 残す（2026-11-09、PM。本文の表示と揃える）
   */
  summary: string | null;
  body: string;
  /** 初めて公開した日時（FR-013） */
  publishedAt: string;
  cardImage: VisitorNoteCardImage;
  /**
   * 公開した版の本文が指す画像のうち、その note の画像の置き場のキー。現れた順。画像の `src` は
   * この並びにある値だけから作る（research.md の R11・R12）
   */
  media: MediaStorageKey[];
  /** 公開した版の URL だけの段落が指す参照先の情報。取ったことのある URL だけ */
  linkPreviews: VisitorLinkPreview[];
};
