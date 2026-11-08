import { newResumeSlug, type EditTimes, type ResumeId } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';
import { toEditOutcome, type EditOutcome } from './edit-outcome';

/**
 * 限定公開用の URL を出し直す（FR-040）。識別子を新しい uid に作り直し、古い URL は 404 になる。
 * オーナーでなければ何も書かない（FR-033）。公開用は `not-found`
 */
export const regenerateResumeUrl = async (
  resumes: ResumeRepository,
  author: Author | null,
  id: ResumeId,
  times: EditTimes,
): Promise<EditOutcome<Record<string, never>, Record<string, never>>> => {
  if (!author) return { status: 'forbidden' };
  return toEditOutcome(await resumes.regenerateLimitedSlug(id, newResumeSlug(), times), {});
};
