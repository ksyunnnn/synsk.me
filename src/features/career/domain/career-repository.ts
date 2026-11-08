import type { Uid } from '@/shared/domain/uid';
import type {
  Career,
  CareerContent,
  CareerId,
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
  /** 作り手の一覧。始まりの日の新しい順 */
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
  /** 物理削除する（research.md の R8） */
  delete: (id: CareerId) => Promise<{ ok: boolean }>;
  hasId: (id: CareerId) => Promise<boolean>;
};
