import type {
  EditTimes,
  NewResume,
  NewResumeContent,
  Resume,
  ResumeCareerContent,
  ResumeContent,
  ResumeEducationContent,
  ResumeForEdit,
  ResumeId,
  ResumeProjectContent,
  ResumeRowKind,
  ResumeSelection,
  ResumeSettings,
  ResumeSkillOverride,
  ResumeSources,
  ResumeStatus,
} from '@/features/resume/domain/resume';
import type { Uid } from '@/shared/domain/uid';

/**
 * 職務経歴書の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/resume/server/d1-resume-repository.ts にある
 */

/** 書き込みの結果。開いたときの更新日時と今の更新日時が違えば `conflict`（research.md の R8） */
export type EditResult = { ok: true } | { ok: false; reason: 'conflict' | 'not-found' };

export type ResumeRepository = {
  /** 写し元。`all` ならすべて、そうでなければ選んだ id だけ。始まりの日の新しい順 */
  readSources: (selection: ResumeSelection | 'all') => Promise<ResumeSources>;
  /** `resume` と写した行を 1 回の `batch()` で入れる（research.md の R4）。更新日時は楽観ロックに使う */
  create: (resume: NewResume) => Promise<{ id: ResumeId; uid: Uid; updatedAt: string }>;
  /**
   * 作ったあとに、写した行を足す（FR-041）。楽観ロックは書き換えと同じ（research.md の R8）。
   * 写した経験年数の上書きは、その職務経歴書に同じ名前の上書きが無いものだけを入れる（R14）
   */
  addRows: (id: ResumeId, content: NewResumeContent, times: EditTimes) => Promise<EditResult>;
  /** 作り手の一覧。作った日時の新しい順 */
  list: () => Promise<Resume[]>;
  findForEdit: (id: ResumeId) => Promise<ResumeForEdit | null>;
  /** 管理画面の URL とフォームの uid が指す職務経歴書の id。無ければ null */
  findIdByUid: (uid: Uid) => Promise<ResumeId | null>;
  /** uid が指す写した行の id。行が無いか、その職務経歴書に属さなければ null */
  findRowIdByUid: (id: ResumeId, kind: ResumeRowKind, rowUid: Uid) => Promise<number | null>;
  /**
   * 訪問者に中身を返してよい限定公開用の id。識別子が合い、訪問者に見せる状態で、期限の前か
   * 期限が無いときだけ返す（FR-011・FR-014・FR-022・FR-023、research.md の R6）
   */
  findLimitedIdForVisitor: (slug: string, now: string) => Promise<ResumeId | null>;
  /** 写した中身。始まりの日の新しい順（FR-009） */
  readContent: (id: ResumeId) => Promise<ResumeContent>;
  editSettings: (id: ResumeId, settings: ResumeSettings, times: EditTimes) => Promise<EditResult>;
  changeStatus: (id: ResumeId, status: ResumeStatus, times: EditTimes) => Promise<EditResult>;
  /** 限定公開用の識別子を新しい uid に書き換える（FR-040）。公開用の行は書き換えず `not-found` */
  regenerateLimitedSlug: (id: ResumeId, slug: string, times: EditTimes) => Promise<EditResult>;
  editCareer: (
    id: ResumeId,
    rowId: number,
    content: ResumeCareerContent,
    times: EditTimes,
  ) => Promise<EditResult>;
  editProject: (
    id: ResumeId,
    rowId: number,
    content: ResumeProjectContent,
    times: EditTimes,
  ) => Promise<EditResult>;
  editEducation: (
    id: ResumeId,
    rowId: number,
    content: ResumeEducationContent,
    times: EditTimes,
  ) => Promise<EditResult>;
  /** 写した経験年数の上書きを入れ直す（FR-028・FR-031） */
  editSkillOverrides: (
    id: ResumeId,
    overrides: ResumeSkillOverride[],
    times: EditTimes,
  ) => Promise<EditResult>;
  /** 子の行から物理削除する（research.md の R9） */
  delete: (id: ResumeId) => Promise<{ ok: boolean }>;
};
