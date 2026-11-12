import type { MediaStorageKey } from '@/shared/domain/media';
import type { Uid } from '@/shared/domain/uid';
import type {
  Project,
  ProjectContent,
  ProjectId,
  ProjectListFilter,
  ProjectOrganizationOption,
  ProjectSummary,
  VisitorProject,
} from '@/features/project/domain/project';

/**
 * 実績の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/project/server/d1-project-repository.ts にある。
 * 単体の検査は、作り物の実装を渡してユースケースを確かめる
 */

/** 保存できなかった理由 */
export type ProjectWriteFailure =
  /** 識別子がほかの実績と重なる（FR-013） */
  | 'slug-taken'
  /** 秘匿化する実績が、秘匿化した組織名の無い組織を指す（FR-001） */
  | 'masked-name-required'
  /** 開いた後に、先に書き換えられていた（FR-042） */
  | 'conflict';

export type ProjectRepository = {
  /**
   * 訪問者に見せる実績。秘匿化した実績では、隠す列を読まない（research.md の R5）。
   * 無い識別子と、サイトに載せない実績の識別子なら null（spec の FR-014・FR-045）
   */
  findVisitorBySlug: (slug: string) => Promise<VisitorProject | null>;
  /** オーナーが編集する実績。無い id なら null */
  findForEdit: (id: ProjectId) => Promise<Project | null>;
  /** 管理画面の URL とフォームの uid が指す実績の id。無ければ null */
  findIdByUid: (uid: Uid) => Promise<ProjectId | null>;
  /**
   * オーナーの一覧。始まりの日の新しい順。条件を渡せば、どの条件も満たす実績だけ。
   * 無い組織の uid を渡せば、空を返す
   */
  list: (filter?: Partial<ProjectListFilter>) => Promise<ProjectSummary[]>;
  /** オーナーの一覧を組織で絞る選択肢。実績を持つ組織だけを、名前の順に返す */
  listOrganizationOptions: () => Promise<ProjectOrganizationOption[]>;
  register: (
    content: ProjectContent & { slug: string },
  ) => Promise<
    | { ok: true; id: ProjectId; uid: Uid }
    | { ok: false; reason: Exclude<ProjectWriteFailure, 'conflict'> }
  >;
  /**
   * 開いたときの更新日時 `openedUpdatedAt` と今の更新日時が一致するときだけ書く
   * （research.md の R7）。`now` は新しい更新日時。開いた後に消されていたら `not-found`
   */
  edit: (
    id: ProjectId,
    content: ProjectContent & { slug: string },
    times: { openedUpdatedAt: string; now: string },
  ) => Promise<{ ok: true } | { ok: false; reason: ProjectWriteFailure | 'not-found' }>;
  /**
   * 物理削除する（research.md の R8）。画像の行も消し、消した画像の置き場のキーを返す。置き場の
   * 実体はユースケースが消す。無い id なら `ok: false`
   */
  delete: (id: ProjectId) => Promise<{ ok: true; storageKeys: MediaStorageKey[] } | { ok: false }>;
  /**
   * 置き場に置いた画像を、その実績の画像として記録する（FR-027）。`asCardImage` なら、同じ
   * トランザクションで代表画像にする（FR-028）。無い id なら `ok: false`
   */
  addMedia: (
    id: ProjectId,
    media: { storageKey: MediaStorageKey; size: number },
    options: { asCardImage: boolean },
  ) => Promise<{ ok: boolean }>;
  /**
   * 代表画像を選ぶ（FR-028）。null なら外す。選べるのはその実績の画像だけで、ほかのキーなら
   * `media-not-owned`。無い id なら `not-found`
   */
  changeCardImage: (
    id: ProjectId,
    storageKey: MediaStorageKey | null,
  ) => Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'media-not-owned' }>;
  /** 識別子の実績があるか。`findVisitorBySlug` が null を返さない識別子と一致する */
  hasSlug: (slug: string) => Promise<boolean>;
  /** 実績の入力でつなげるスキルの選択肢。名前の順（FR-032） */
  listSkillOptions: () => Promise<{ id: number; name: string }[]>;
};
