import {
  buildResumeContent,
  countCopiedRows,
  countSelected,
  hasAllSources,
  MAX_COPIED_ROWS,
} from '@/features/resume/domain/build-resume';
import {
  copiedSourceIds,
  parseResumeId,
  selectionOf,
  type EditTimes,
  type ResumeId,
  type ResumeRowKind,
} from '@/features/resume/domain/resume';
import type { AddResumeRowsErrors } from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import { toEditOutcome, type EditOutcome } from './edit-outcome';

export type AddResumeRowsOutcome = EditOutcome<string[], AddResumeRowsErrors>;

/**
 * 作ったあとに、元の職歴・実績・学歴から選んだ行を職務経歴書に足す（FR-041）。写し方は作るときと
 * 同じ（`buildResumeContent`）。作り手でなければ何も読まず何も書かない（FR-033）。読む → 計算 →
 * 書くの順（docs/SOFTWARE_DESIGN.md）。
 *
 * 既に写した写し元は足さない。開いた後に選んだ写し元が消えていたら、作るときと同じく足さずに
 * 知らせる（research.md の R14）。写す行が上限を超えたら、作るときと同じく足さずに知らせる
 * （research.md の R15）
 */
export const addResumeRows = async (
  resumes: ResumeRepository,
  author: Author | null,
  target: { id: ResumeId; kind: ResumeRowKind },
  values: string[],
  times: EditTimes,
): Promise<AddResumeRowsOutcome> => {
  if (!author) return { status: 'forbidden' };

  const parsed = values.map(parseResumeId);
  if (parsed.includes(null)) return { status: 'invalid', errors: { selection: 'invalid' }, values };
  const ids = [...new Set(parsed as number[])];
  if (ids.length === 0) return { status: 'invalid', errors: { selection: 'missing' }, values };
  const selection = selectionOf(target.kind, ids);
  if (countSelected(selection) > MAX_COPIED_ROWS) {
    return { status: 'invalid', errors: { selection: 'too-many' }, values };
  }

  // 読む: 職務経歴書と、選んだ写し元
  const resume = await resumes.findForEdit(target.id);
  if (!resume) return { status: 'not-found' };
  if (resume.updatedAt !== times.openedUpdatedAt) return { status: 'conflict', values };
  const copied = copiedSourceIds(resume, target.kind);
  if (ids.some((id) => copied.has(id))) {
    return { status: 'invalid', errors: { selection: 'already-copied' }, values };
  }
  const sources = await resumes.readSources(selection);
  if (!hasAllSources(sources, selection)) {
    return { status: 'invalid', errors: { selection: 'source-missing' }, values };
  }

  // 計算: 作るときと同じ写し方
  const built = buildResumeContent(sources, selection, resume.audience);
  if (!built.ok) return { status: 'invalid', errors: { selection: built.reason }, values };
  if (countCopiedRows(built.content) > MAX_COPIED_ROWS) {
    return { status: 'invalid', errors: { selection: 'too-many' }, values };
  }

  // 書く
  return toEditOutcome(await resumes.addRows(target.id, built.content, times), values);
};
