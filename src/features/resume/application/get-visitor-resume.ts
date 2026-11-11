import type { Profile } from '@/features/resume/domain/profile';
import type { ResumeId } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import {
  toLimitedVisitorResume,
  type VisitorResume,
} from '@/features/resume/domain/visitor-resume';

/**
 * 訪問者に見せる限定公開用。条件に合わなければ null（FR-011・FR-014・FR-022・FR-023）。
 * 条件に合わないときは写した行を読まない（research.md の R6）
 */
export const getVisitorLimitedResume = async (
  resumes: ResumeRepository,
  { slug, profile, now }: { slug: string; profile: Profile; now: Date },
): Promise<VisitorResume | null> => {
  const id = await resumes.findLimitedIdForVisitor(slug, now.toISOString());
  if (id === null) return null;
  return toLimitedVisitorResume(await resumes.readContent(id), profile, now);
};

/**
 * 訪問者に見せたときの見た目（REQUIREMENTS.md の FR-13）。状態・期限に関わらず、訪問者向けと
 * 同じ DTO を作る。オーナーの確認と、id の職務経歴書があるかの確認は、呼ぶ側が読む前に行う
 */
export const getResumePreview = async (
  resumes: ResumeRepository,
  { id, profile, now }: { id: ResumeId; profile: Profile; now: Date },
): Promise<VisitorResume> => toLimitedVisitorResume(await resumes.readContent(id), profile, now);
