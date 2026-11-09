import type { Uid } from '@/shared/domain/uid';
import type {
  Note,
  NoteId,
  NoteInput,
  NoteSummary,
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
  /** 開いた後に、別の画面で先に版が足されていた（FR-020） */
  | 'conflict'
  /** note が無いか、削除した */
  | 'not-found';

export type NoteRepository = {
  /**
   * 訪問者に見せる note。公開で削除していない note の、公開した版だけを詰める（research.md の R7）。
   * それ以外の識別子なら null
   */
  findVisitorBySlug: (slug: string) => Promise<VisitorNote | null>;
  /** 訪問者に見せる note がある識別子か。`findVisitorBySlug` が null を返さない識別子と一致する */
  hasVisitorSlug: (slug: string) => Promise<boolean>;
  /** オーナーが編集する note。削除した note も返す。無い id なら null */
  findForEdit: (id: NoteId) => Promise<Note | null>;
  /** 管理画面の URL とフォームの uid が指す note の id。削除した note も返す。無ければ null */
  findIdByUid: (uid: Uid) => Promise<NoteId | null>;
  /** オーナーの一覧。削除した note も含め、作った日時の新しい順 */
  list: () => Promise<NoteSummary[]>;
  /** note と 1 つ目の版を作る（FR-001）。作った note は下書き */
  create: (
    input: NoteInput,
  ) => Promise<{ ok: true; id: NoteId; uid: Uid } | { ok: false; reason: 'slug-taken' }>;
  /**
   * 版を 1 つ足す（FR-006）。その note の最も新しい版の uid が `openedRevisionUid` と同じときだけ
   * 書く（FR-020、research.md の R4）。識別子が違えば、同じトランザクションで書き換える
   */
  save: (
    id: NoteId,
    input: NoteInput,
    openedRevisionUid: Uid,
  ) => Promise<{ ok: true } | { ok: false; reason: NoteWriteFailure }>;
  /**
   * 最も新しい版を公開した版にする（FR-011・FR-013）。初めて公開した日時は空のときだけ `now` を
   * 入れる。最も新しい版の題が空なら `untitled`
   */
  publish: (
    id: NoteId,
    now: string,
  ) => Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'untitled' }>;
};
