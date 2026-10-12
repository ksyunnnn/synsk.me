import type {
  DeletedNote,
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
 * 削除した note は、`restore`・`findDeleted`・`listDeletedForAuthor` だけが扱う。
 * ほかの操作は、削除した note を存在しないものとして扱う。
 *
 * 受け取る `NoteContent` は、呼ぶ側が `validateDraft` か `validatePublication` で
 * 確かめたものとする。確かめていない値はデータベースの制約が拒み、例外になる。
 */

/** slug が他の note と重なる。削除した note の slug とも重ねられない */
type SlugTaken = { ok: false; reason: 'slug-taken' };
/** id の note が存在しないか、操作できる状態にない（別の画面で削除された、戻された） */
type NotFound = { ok: false; reason: 'not-found' };
/** 公開した note の slug を変えようとした */
type SlugFixed = { ok: false; reason: 'slug-fixed' };

export type CreateNoteResult = { ok: true; id: NoteId } | SlugTaken;
export type UpdateNoteResult = { ok: true } | SlugTaken | NotFound | SlugFixed;
export type DeleteNoteResult = { ok: true } | NotFound;
export type RestoreNoteResult = { ok: true } | NotFound;

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

  /**
   * note を削除する。行を消さず、`deletedAt` を削除した日時として入れる。
   * 公開している内容も残す
   */
  delete(id: NoteId, deletedAt: string): Promise<DeleteNoteResult>;

  /** 削除した note を戻す。状態（下書きか公開か）は削除する前のままになる */
  restore(id: NoteId): Promise<RestoreNoteResult>;

  /** 公開済みの note を slug で取り出す。下書き・削除した note・存在しない slug は区別せず null */
  findPublishedBySlug(slug: string): Promise<PublishedNote | null>;

  /** 作り手が編集する note を id で取り出す */
  findForEdit(id: NoteId): Promise<EditableNote | null>;

  /** 作り手向けに、削除していないすべての note を一覧する */
  listForAuthor(): Promise<NoteSummary[]>;

  /** 削除した note を id で取り出す。削除していない note と存在しない id は null */
  findDeleted(id: NoteId): Promise<DeletedNote | null>;

  /** 作り手向けに、削除した note を一覧する */
  listDeletedForAuthor(): Promise<DeletedNote[]>;
}
