import type {
  EditTimes,
  NewResume,
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
  create: (resume: NewResume) => Promise<{ id: ResumeId; updatedAt: string }>;
  /** 作り手の一覧。作った日時の新しい順 */
  list: () => Promise<Resume[]>;
  findForEdit: (id: ResumeId) => Promise<ResumeForEdit | null>;
  /**
   * 訪問者に中身を返してよい限定公開用の id。訪問者に見せる状態で、期限の前か期限が無く、
   * 鍵が合うときだけ返す（FR-011・FR-014・FR-022・FR-023、research.md の R6）
   */
  findLimitedIdForVisitor: (slug: string, key: string, now: string) => Promise<ResumeId | null>;
  /** 写した中身。始まりの日の新しい順（FR-009） */
  readContent: (id: ResumeId) => Promise<ResumeContent>;
  editSettings: (id: ResumeId, settings: ResumeSettings, times: EditTimes) => Promise<EditResult>;
  changeStatus: (id: ResumeId, status: ResumeStatus, times: EditTimes) => Promise<EditResult>;
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
  hasId: (id: ResumeId) => Promise<boolean>;
  /** 写した行があり、その職務経歴書に属するか */
  hasRow: (id: ResumeId, kind: ResumeRowKind, rowId: number) => Promise<boolean>;
};
