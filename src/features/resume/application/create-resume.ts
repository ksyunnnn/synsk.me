import { buildResumeContent } from '@/features/resume/domain/build-resume';
import { generateLimitedKey, hashLimitedKey } from '@/features/resume/domain/limited-key';
import {
  newResumeSlug,
  parseExpiresInput,
  parseResumeId,
  type ResumeAudience,
  type ResumeId,
  type ResumeSelection,
} from '@/features/resume/domain/resume';
import type {
  CreateResumeError,
  CreateResumeField,
  CreateResumeFormValues,
} from '@/features/resume/domain/resume-forms';
import type { ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { Author } from '@/shared/domain/author';

export type CreateResumeOutcome =
  /** `key` は限定公開用の鍵の平文。D1 には無く、この結果の中でだけ持つ（research.md の R5） */
  | {
      status: 'created';
      id: ResumeId;
      updatedAt: string;
      audience: ResumeAudience;
      slug: string;
      key: string | null;
    }
  | { status: 'forbidden' }
  | {
      status: 'invalid';
      errors: Partial<Record<CreateResumeField, CreateResumeError>>;
      values: CreateResumeFormValues;
    };

const parseIds = (values: string[]) => values.map(parseResumeId);

/**
 * 職務経歴書を作る（FR-001・FR-003・FR-005・FR-007・FR-011〜FR-013・FR-021）。作り手でなければ
 * 何も読まず何も書かない（FR-033）。読む → 計算 → 書くの順（docs/SOFTWARE_DESIGN.md）。
 *
 * 1 件も選ばずに作れるかは plan.md の U12 で決まっていないため、拒まない。公開用は tasks.md の
 * Phase 7（US5）で足すまで拒む
 */
export const createResume = async (
  resumes: ResumeRepository,
  author: Author | null,
  values: CreateResumeFormValues,
): Promise<CreateResumeOutcome> => {
  if (!author) return { status: 'forbidden' };

  const errors: Partial<Record<CreateResumeField, CreateResumeError>> = {};
  const title = values.title.trim();
  if (title === '') errors.title = 'missing';

  const audience: ResumeAudience | null =
    values.audience === '' || values.audience === 'limited'
      ? 'limited'
      : values.audience === 'public'
        ? 'public'
        : null;
  if (audience === null) errors.audience = 'invalid';
  else if (audience === 'public') errors.audience = 'public-not-supported';

  const expires = parseExpiresInput(values.expires);
  if (!expires.ok) errors.expires = 'invalid';

  const ids = {
    careerIds: parseIds(values.careerIds),
    projectIds: parseIds(values.projectIds),
    educationIds: parseIds(values.educationIds),
  };
  if (Object.values(ids).some((list) => list.includes(null))) errors.selection = 'invalid';

  if (Object.keys(errors).length > 0 || audience === null || !expires.ok) {
    return { status: 'invalid', errors, values };
  }
  const selection = ids as ResumeSelection;

  // 読む: 選んだ写し元。開いた後に消えた行があれば作らない
  const sources = await resumes.readSources(selection);
  const found = {
    careerIds: sources.careers.length,
    projectIds: sources.projects.length,
    educationIds: sources.educations.length,
  };
  const allFound = (Object.keys(found) as (keyof typeof found)[]).every(
    (key) => found[key] === new Set(selection[key]).size,
  );
  if (!allFound) return { status: 'invalid', errors: { selection: 'source-missing' }, values };

  // 計算: 写す行と鍵
  const built = buildResumeContent(sources, selection, audience);
  if (!built.ok) return { status: 'invalid', errors: { audience: built.reason }, values };
  const key = audience === 'limited' ? generateLimitedKey() : null;
  const slug = newResumeSlug();

  // 書く
  const { id, updatedAt } = await resumes.create({
    slug,
    title,
    audience,
    limitedTokenHash: key === null ? null : await hashLimitedKey(key),
    limitedExpiresAt: audience === 'limited' ? expires.expiresAt : null,
    content: built.content,
  });
  return { status: 'created', id, updatedAt, audience, slug, key };
};
