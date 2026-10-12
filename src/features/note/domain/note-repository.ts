import type {
  EditableNote,
  NoteContent,
  NoteId,
  NoteSummary,
  PublishedNote,
} from '@/features/note/domain/note';

/**
 * note の取り出し方と保存の仕方。実装は `server/` に置く。
 *
 * 規則に照らして起こりうる結果は戻り値で区別して返す。データベースに届かない
 * などの失敗は例外として投げる。
 *
 * 受け取る `NoteContent` は、呼ぶ側が `validateDraft` か `validatePublication` で
 * 確かめたものとする。確かめていない値はデータベースの制約が拒み、例外になる。
 */

/** slug が他の note と重なる */
type SlugTaken = { ok: false; reason: 'slug-taken' };
/** id の note が存在しない（別の画面で削除された） */
type NotFound = { ok: false; reason: 'not-found' };
/** 公開した note の slug を変えようとした */
type SlugFixed = { ok: false; reason: 'slug-fixed' };

export type CreateNoteResult = { ok: true; id: NoteId } | SlugTaken;
export type UpdateNoteResult = { ok: true } | SlugTaken | NotFound | SlugFixed;
export type DeleteNoteResult = { ok: true } | NotFound;

export interface NoteRepository {
  /** 下書きの note を作る */
  create(content: NoteContent): Promise<CreateNoteResult>;

  /** 書き換えている内容を保存する。公開している内容は変えない */
  save(id: NoteId, content: NoteContent): Promise<UpdateNoteResult>;

  /**
   * 入力した内容を保存し、その題と本文を公開する。保存と公開は1つの書き込みで、
   * 片方だけが残ることはない。初めて公開するときだけ `publishedAt` を初めて
   * 公開した日時にする
   */
  publish(id: NoteId, content: NoteContent, publishedAt: string): Promise<UpdateNoteResult>;

  /** note を、公開している内容とともに削除する */
  delete(id: NoteId): Promise<DeleteNoteResult>;

  /** 公開済みの note を slug で取り出す。下書きと存在しない slug は区別せず null */
  findPublishedBySlug(slug: string): Promise<PublishedNote | null>;

  /** 作り手が編集する note を id で取り出す */
  findForEdit(id: NoteId): Promise<EditableNote | null>;

  /** 作り手向けに、すべての note を一覧する */
  listForAuthor(): Promise<NoteSummary[]>;
}
