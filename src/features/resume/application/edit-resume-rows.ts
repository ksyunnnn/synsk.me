import type { EditTimes, ResumeId } from '@/features/resume/domain/resume';
import {
  parseResumeCareer,
  parseResumeEducation,
  parseResumeProject,
  parseSkillOverrides,
  type FieldError,
  type ResumeCareerField,
  type ResumeCareerFormValues,
  type ResumeEducationField,
  type ResumeEducationFormValues,
  type ResumeProjectField,
  type ResumeProjectFormValues,
  type SkillOverrideFormRow,
} from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import { toEditOutcome, type EditOutcome } from './edit-outcome';

/**
 * 職務経歴書の中で写した値を直す（FR-031・FR-032・FR-038）。直した値はその職務経歴書にだけ効き、
 * 写し元とほかの職務経歴書は変わらない。オーナーでなければ何も書かない（FR-033）。秘匿化するか
 * どうかの入力を受け取らない（FR-031）
 */

type Errors<F extends string> = Partial<Record<F, FieldError>>;

export const editResumeCareer = async (
  resumes: ResumeRepository,
  author: Author | null,
  target: { id: ResumeId; rowId: number },
  values: ResumeCareerFormValues,
  times: EditTimes,
): Promise<EditOutcome<ResumeCareerFormValues, Errors<ResumeCareerField>>> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseResumeCareer(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  return toEditOutcome(
    await resumes.editCareer(target.id, target.rowId, parsed.content, times),
    values,
  );
};

export const editResumeProject = async (
  resumes: ResumeRepository,
  author: Author | null,
  target: { id: ResumeId; rowId: number },
  values: ResumeProjectFormValues,
  times: EditTimes,
): Promise<EditOutcome<ResumeProjectFormValues, Errors<ResumeProjectField>>> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseResumeProject(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  return toEditOutcome(
    await resumes.editProject(target.id, target.rowId, parsed.content, times),
    values,
  );
};

export const editResumeEducation = async (
  resumes: ResumeRepository,
  author: Author | null,
  target: { id: ResumeId; rowId: number },
  values: ResumeEducationFormValues,
  times: EditTimes,
): Promise<EditOutcome<ResumeEducationFormValues, Errors<ResumeEducationField>>> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseResumeEducation(values);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };
  return toEditOutcome(
    await resumes.editEducation(target.id, target.rowId, parsed.content, times),
    values,
  );
};

/** 写した経験年数の上書きを、年と月で受け取り月数で保存する（FR-028） */
export const editResumeSkillOverrides = async (
  resumes: ResumeRepository,
  author: Author | null,
  id: ResumeId,
  rows: SkillOverrideFormRow[],
  times: EditTimes,
): Promise<EditOutcome<SkillOverrideFormRow[], { invalidRows: number[] }>> => {
  if (!author) return { status: 'forbidden' };
  const parsed = parseSkillOverrides(rows);
  if (!parsed.ok) {
    return { status: 'invalid', errors: { invalidRows: parsed.invalidRows }, values: rows };
  }
  return toEditOutcome(await resumes.editSkillOverrides(id, parsed.overrides, times), rows);
};
