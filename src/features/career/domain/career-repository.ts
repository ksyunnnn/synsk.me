import type { Uid } from '@/shared/domain/uid';
import type {
  Career,
  CareerContent,
  CareerId,
  CareerProjectSource,
  CareerSummary,
} from '@/features/career/domain/career';

/**
 * 職歴の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/career/server/d1-career-repository.ts にある
 */
export type CareerRepository = {
  findForEdit: (id: CareerId) => Promise<Career | null>;
  /** 管理画面の URL とフォームの uid が指す職歴の id。無ければ null */
  findIdByUid: (uid: Uid) => Promise<CareerId | null>;
  /** オーナーの一覧。始まりの日の新しい順 */
  list: () => Promise<CareerSummary[]>;
  register: (
    content: CareerContent,
  ) => Promise<
    { ok: true; id: CareerId; uid: Uid } | { ok: false; reason: 'masked-name-required' }
  >;
  /**
   * 開いたときの更新日時と今の更新日時が一致するときだけ書く（research.md の R7）。
   * 開いた後に消されていたら `not-found`
   */
  edit: (
    id: CareerId,
    content: CareerContent,
    times: { openedUpdatedAt: string; now: string },
  ) => Promise<
    { ok: true } | { ok: false; reason: 'masked-name-required' | 'conflict' | 'not-found' }
  >;
  /**
   * 組織の実績と、つないだスキルの名前。始まりの日の新しい順。`published` ならサイトに載せる
   * 実績だけ（FR-035）。職歴の実績を求めるのに使う（FR-017）
   */
  listProjectsOfOrganization: (
    organizationId: number,
    scope: 'all' | 'published',
  ) => Promise<CareerProjectSource[]>;
  /**
   * 物理削除する（research.md の R8）。消した画像の R2 のキーを返し、ユースケースが置き場から消す
   */
  delete: (id: CareerId) => Promise<{ ok: true; storageKeys: string[] } | { ok: false }>;
  /**
   * 画像の行を足す（FR-027）。1 つの職歴の画像が上限（`IMAGE_MAX_COUNT`）に達していたら
   * 足さない。更新日時は変えない（編集の画面の入力を止めないため）
   */
  addImage: (
    id: CareerId,
    storageKey: string,
  ) => Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'too-many-images' }>;
  /** オーナーが見る画像の R2 のキー。その職歴の画像でなければ null */
  findOwnerImage: (id: CareerId, storageKey: string) => Promise<string | null>;
};
