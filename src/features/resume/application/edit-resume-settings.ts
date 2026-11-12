import { parseExpiresInput, type EditTimes, type ResumeId } from '@/features/resume/domain/resume';
import type {
  FieldError,
  ResumeSettingsField,
  ResumeSettingsResult,
  ResumeSettingsValues,
} from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import { toEditOutcome } from '@/features/resume/domain/edit-outcome';

/**
 * 題と期限を直す（FR-001・FR-013・FR-014）。期限を過ぎた後に先の日時にすると、同じ URL で
 * もう一度読める。識別子の入力を持たないため、限定公開用の識別子は書き換わらない（FR-037）。
 * 公開用の識別子の書き換え（FR-039）は tasks.md の Phase 7（US5）で足す
 */
export const editResumeSettings = async (
  resumes: ResumeRepository,
  author: Author | null,
  id: ResumeId,
  values: ResumeSettingsValues,
  times: EditTimes,
): Promise<ResumeSettingsResult> => {
  if (!author) return { status: 'forbidden' };
  const errors: Partial<Record<ResumeSettingsField, FieldError>> = {};
  const title = values.title.trim();
  if (title === '') errors.title = 'missing';
  const expires = parseExpiresInput(values.expires);
  if (!expires.ok) errors.expires = 'invalid';
  if (Object.keys(errors).length > 0 || !expires.ok) return { status: 'invalid', errors, values };

  return toEditOutcome(
    await resumes.editSettings(id, { title, limitedExpiresAt: expires.expiresAt }, times),
    values,
  );
};
