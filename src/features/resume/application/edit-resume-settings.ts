import {
  isResumeSlug,
  parseExpiresInput,
  type EditTimes,
  type ResumeId,
} from '@/features/resume/domain/resume';
import type {
  ResumeSettingsError,
  ResumeSettingsField,
} from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import { toEditOutcome, type EditOutcome } from './edit-outcome';

export type ResumeSettingsValues = Record<ResumeSettingsField, string>;

/**
 * 題・期限・公開用の識別子を直す（FR-001・FR-013・FR-014・FR-039）。期限を過ぎた後に先の日時に
 * すると、同じ URL でもう一度読める。限定公開用は識別子の入力を読まず、識別子は書き換わらない
 * （FR-037）。公開用は期限を持たず、期限の入力を読まない。公開用の識別子は形を確かめ、別の
 * 職務経歴書と重なれば保存しない（`resume.slug` の UNIQUE）
 */
export const editResumeSettings = async (
  resumes: ResumeRepository,
  author: Author | null,
  id: ResumeId,
  values: ResumeSettingsValues,
  times: EditTimes,
): Promise<
  EditOutcome<ResumeSettingsValues, Partial<Record<ResumeSettingsField, ResumeSettingsError>>>
> => {
  if (!author) return { status: 'forbidden' };
  // 読む: 限定公開用か公開用か。作った後に変わらない（FR-004）
  const resume = await resumes.findForEdit(id);
  if (!resume) return { status: 'not-found' };
  const isPublic = resume.audience === 'public';
  const errors: Partial<Record<ResumeSettingsField, ResumeSettingsError>> = {};
  const title = values.title.trim();
  if (title === '') errors.title = 'missing';
  const expires = parseExpiresInput(isPublic ? '' : values.expires);
  if (!expires.ok) errors.expires = 'invalid';
  const slug = isPublic ? values.slug.trim() : null;
  if (slug !== null && !isResumeSlug(slug)) errors.slug = slug === '' ? 'missing' : 'invalid';
  if (Object.keys(errors).length > 0 || !expires.ok) return { status: 'invalid', errors, values };
  if (slug !== null && (await resumes.isSlugTaken(slug, id))) {
    return { status: 'invalid', errors: { slug: 'taken' }, values };
  }

  return toEditOutcome(
    await resumes.editSettings(id, { title, limitedExpiresAt: expires.expiresAt, slug }, times),
    values,
  );
};
