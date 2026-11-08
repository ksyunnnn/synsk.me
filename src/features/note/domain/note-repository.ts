import type { Uid } from '@/shared/domain/uid';
import type {
  CardImageSource,
  LinkPreview,
  NoteContent,
  NoteForEdit,
  NoteId,
  NoteRevision,
  NoteSummary,
  RevisionNumber,
  VisitorNote,
} from '@/features/note/domain/note';

/**
 * note の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/note/server/d1-note-repository.ts にある。
 * 単体の検査は、作り物の実装を渡してユースケースを確かめる
 */

/** 書けなかった理由 */
export type NoteWriteFailure =
  /** 識別子がほかの note と重なる。削除した note も含む（FR-002） */
  | 'slug-taken'
  /** 一度でも公開した note の識別子を変えようとした（FR-003） */
  | 'slug-locked'
  /** 開いた後に、別の画面で版が保存されていた（FR-020） */
  | 'conflict'
  /** 削除した note。戻すまで書き換えない（research.md の R5） */
  | 'deleted'
  /** 題が空の版を公開しようとした（FR-011） */
  | 'empty-title'
  /** 1 つの note の画像の数の上限を超える（research.md の R7） */
  | 'too-many-images'
  /** その note の画像でない（FR-025） */
  | 'not-own-image'
  /** 転載先の URL がすでに記録されている（FR-032） */
  | 'syndication-taken'
  | 'not-found';

export type WriteResult<R extends NoteWriteFailure, T = object> =
  ({ ok: true } & T) | { ok: false; reason: R | 'not-found' };

export type NoteRepository = {
  /** オーナーの一覧。削除した note も含む。作った順の新しい順 */
  list: () => Promise<NoteSummary[]>;
  findForEdit: (id: NoteId) => Promise<NoteForEdit | null>;
  findIdByUid: (uid: Uid) => Promise<NoteId | null>;
  /** 版の一覧。番号の新しい順 */
  listRevisions: (id: NoteId) => Promise<NoteRevision[]>;
  findRevision: (id: NoteId, number: RevisionNumber) => Promise<NoteRevision | null>;

  /** 作る。下書きで、最初の版を 1 つ持つ（FR-001） */
  create: (
    slug: string,
    content: NoteContent,
  ) => Promise<WriteResult<'slug-taken', { id: NoteId; uid: Uid }>>;
  /**
   * 版を 1 つ足す。最新の版の番号が `openedRevision` と一致するときだけ書く（research.md の R4）。
   * 識別子も書く
   */
  save: (
    id: NoteId,
    slug: string,
    content: NoteContent,
    openedRevision: RevisionNumber,
  ) => Promise<
    WriteResult<'slug-taken' | 'slug-locked' | 'conflict' | 'deleted', { revision: number }>
  >;
  /** 最新の版を公開する。最新の版の番号が `openedRevision` と一致するときだけ書く */
  publish: (
    id: NoteId,
    openedRevision: RevisionNumber,
    now: string,
  ) => Promise<WriteResult<'conflict' | 'deleted' | 'empty-title'>>;
  /** 下書きに戻す。公開した版と初めて公開した日時は残す（FR-014） */
  unpublish: (id: NoteId) => Promise<WriteResult<'deleted'>>;
  /** 削除の印を付ける（FR-016） */
  delete: (id: NoteId, now: string) => Promise<WriteResult<never>>;
  /** 削除の印を外す。状態と版は削除前のまま（FR-016） */
  undelete: (id: NoteId) => Promise<WriteResult<never>>;
  /** 完全に消す（FR-017）。消した画像の R2 のキーを返す。参照先の情報は消さない */
  purge: (id: NoteId) => Promise<WriteResult<never, { storageKeys: string[] }>>;

  /** 画像の記録を足す（R2 に書いた後に呼ぶ） */
  addImage: (id: NoteId, storageKey: string) => Promise<WriteResult<'deleted' | 'too-many-images'>>;
  /** 代表画像を選ぶ（FR-024・FR-025）。`media` のときだけ画像の R2 のキーを渡す */
  chooseCardImage: (
    id: NoteId,
    source: CardImageSource,
    storageKey: string | null,
  ) => Promise<WriteResult<'deleted' | 'not-own-image'>>;
  /** オーナーが見る画像の R2 のキー。その note の画像でなければ null */
  findOwnerImage: (id: NoteId, storageKey: string) => Promise<string | null>;

  addSyndication: (
    id: NoteId,
    url: string,
  ) => Promise<WriteResult<'deleted' | 'syndication-taken'>>;
  removeSyndication: (id: NoteId, url: string) => Promise<WriteResult<'deleted'>>;

  /** 参照先の情報。持っている URL だけを返す */
  findLinkPreviews: (urls: string[]) => Promise<LinkPreview[]>;
  /** 参照先の情報を書く。同じ URL の行があれば取り直した中身に替える（FR-029） */
  saveLinkPreviews: (previews: LinkPreview[], fetchedAt: string) => Promise<void>;

  /**
   * 訪問者に見せる note。公開で削除していない note の、公開した版の列だけを読む
   * （contracts/visitor-note.md）。`linkPreviews` は空で返し、ユースケースが詰める
   */
  findVisitorBySlug: (slug: string) => Promise<VisitorNote | null>;
  /** 訪問者に見せる note がある識別子か。`findVisitorBySlug` が null を返さない識別子と一致する */
  hasVisitorSlug: (slug: string) => Promise<boolean>;
  /**
   * 訪問者に返す画像の R2 のキー（FR-026）。公開で削除していない note の、公開した版の本文が
   * 指す画像か代表画像でなければ null
   */
  findVisitorImage: (slug: string, storageKey: string) => Promise<string | null>;
  hasRevision: (id: NoteId, number: RevisionNumber) => Promise<boolean>;
};
