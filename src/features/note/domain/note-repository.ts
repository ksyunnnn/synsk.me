import type { Uid } from '@/shared/domain/uid';
import type {
  Note,
  NoteId,
  NoteInput,
  NoteRevision,
  NoteRevisionSummary,
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
  /**
   * 下書きに戻す（FR-014）。状態だけを書き、公開した版と初めて公開した日時は残す。無いか削除した
   * note か、公開でない note なら何も書かず `ok: false`
   */
  unpublish: (id: NoteId) => Promise<{ ok: boolean }>;
  /**
   * 削除済みの印を付ける（FR-016）。状態と版は変えない。無い id か削除済みの note なら何も書かず
   * `ok: false`
   */
  delete: (id: NoteId, now: string) => Promise<{ ok: boolean }>;
  /** 削除済みの印を外す（FR-016・SC-007）。状態・版・識別子は削除の前のまま。無い id か削除していない
   * note なら何も書かず `ok: false`
   */
  restore: (id: NoteId) => Promise<{ ok: boolean }>;
  /** 版の一覧。保存した日時の新しい順（FR-008）。最も新しい版と公開した版に印を付ける */
  listRevisions: (id: NoteId) => Promise<NoteRevisionSummary[]>;
  /** その note の 1 つの版を、保存したときのまま返す（FR-008）。別の note の版なら null */
  findRevision: (id: NoteId, revisionUid: Uid) => Promise<NoteRevision | null>;
  /**
   * 戻す版の題・説明文・本文を、新しい版として足す（FR-009）。保存と同じく、最も新しい版の uid が
   * `openedRevisionUid` と同じときだけ書く（research.md の R4）。公開した版は変えない。戻す版が
   * その note に無ければ `revision-not-found`
   */
  revert: (
    id: NoteId,
    revisionUid: Uid,
    openedRevisionUid: Uid,
  ) => Promise<
    { ok: true } | { ok: false; reason: 'conflict' | 'not-found' | 'revision-not-found' }
  >;
  /**
   * 過去の版の画面の有無（`src/proxy.ts`）。note が無ければ `note`、版がその note に無ければ
   * `revision`、どちらもあれば null。note と版を 1 回の問い合わせで確かめる
   */
  findMissingRevision: (uid: Uid, revisionUid: Uid) => Promise<'note' | 'revision' | null>;
};
