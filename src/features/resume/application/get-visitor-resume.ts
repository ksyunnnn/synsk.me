import type { Profile } from '@/features/resume/domain/profile';
import type { ResumeId } from '@/features/resume/domain/resume';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import { toVisitorResume, type VisitorResume } from '@/features/resume/domain/visitor-resume';

/**
 * 訪問者に中身を返してよい職務経歴書の id。限定公開用を先に、無ければ公開用を探す。識別子は
 * 限定公開用と公開用で重ならない（`resume.slug` の UNIQUE）。条件に合わなければ null
 * （FR-011・FR-014・FR-019・FR-022・FR-023、research.md の R6）
 */
export const findVisitorResumeId = async (
  resumes: ResumeRepository,
  slug: string,
  now: Date,
): Promise<ResumeId | null> =>
  (await resumes.findLimitedIdForVisitor(slug, now.toISOString())) ??
  (await resumes.findPublicIdForVisitor(slug));

/**
 * 訪問者に見せる職務経歴書。条件に合わなければ null。条件に合わないときは写した行を読まない
 * （research.md の R6）。公開用で秘匿化した行の本文と関連 URL は読まない（FR-017）
 */
export const getVisitorResume = async (
  resumes: ResumeRepository,
  { slug, profile, now }: { slug: string; profile: Profile; now: Date },
): Promise<VisitorResume | null> => {
  const id = await findVisitorResumeId(resumes, slug, now);
  if (id === null) return null;
  const read = await resumes.readVisitorContent(id);
  return read === null ? null : toVisitorResume(read.audience, read.content, profile, now);
};

/**
 * 訪問者に見せたときの見た目（REQUIREMENTS.md の FR-13）。状態・期限に関わらず、訪問者向けと
 * 同じ DTO を作る。オーナーの確認は、呼ぶ側が読む前に行う。無い id なら null
 */
export const getResumePreview = async (
  resumes: ResumeRepository,
  { id, profile, now }: { id: ResumeId; profile: Profile; now: Date },
): Promise<VisitorResume | null> => {
  const read = await resumes.readVisitorContent(id);
  return read === null ? null : toVisitorResume(read.audience, read.content, profile, now);
};
