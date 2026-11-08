import type {
  NewResumeContent,
  ResumeAudience,
  ResumeSelection,
  ResumeSkillOverride,
  ResumeSources,
} from '@/features/resume/domain/resume';

/**
 * 写し方（specs/002-resume/data-model.md の「写し方」）。読み込んだ写し元と、選んだ id と、
 * 限定公開用か公開用かを受け取り、写す行を返す。副作用を持たない（docs/SOFTWARE_DESIGN.md の
 * 「読む → 計算 → 書く」）。
 *
 * 限定公開用は、秘匿化するかどうかに関わらず、実際の組織名・題・本文・関連 URL を写す（FR-008・
 * FR-010）。写し元が秘匿化していたかは `isMasked` に写す（migration 0008）。
 *
 * 公開用は、サイトに載せる職歴・実績だけを写し、選んでいてもサイトに載せないものは写さない
 * （FR-016）。秘匿化しない行は実際の値を、秘匿化した行は秘匿化した組織名と秘匿化した題を写し、
 * 本文と関連 URL を写さない（FR-008・FR-017・FR-018、research.md の R4）。秘匿化した行の組織に
 * 秘匿化した組織名が無ければ、何も写さずに知らせる（research.md の R4、設計原則 2）
 */

export type BuildResumeResult =
  { ok: true; content: NewResumeContent } | { ok: false; reason: 'masked-name-missing' };

/**
 * 1 回の作成と足す操作で写せる行の数の上限（docs/SOFTWARE_DESIGN.md の設計原則 2、research.md の
 * R15）。写す行は 1 行ごとに D1 の文を 1 つ、1 つの `batch()` に積む。職歴・実績・学歴・実績の
 * スキル・経験年数の上書きを合わせて数える
 */
export const MAX_COPIED_ROWS = 1000;

/** 選んだ写し元の数。写す行は写し元より少なくならないため、読む前に上限と比べる */
export const countSelected = (selection: ResumeSelection): number =>
  new Set(selection.careerIds).size +
  new Set(selection.projectIds).size +
  new Set(selection.educationIds).size;

/** 写す行の数。`MAX_COPIED_ROWS` と比べる */
export const countCopiedRows = (content: NewResumeContent): number =>
  content.careers.length +
  content.projects.reduce((sum, project) => sum + 1 + project.skills.length, 0) +
  content.educations.length +
  content.skillOverrides.length;

/** 写した実績のスキルのうち、元のスキルが経験年数の上書きを持つもの（FR-028）。名前ごとに 1 つ */
const collectOverrides = (sources: ResumeSources['projects']): ResumeSkillOverride[] => {
  const byName = new Map<string, number>();
  for (const project of sources) {
    for (const skill of project.skills) {
      if (skill.monthsOverride !== null && !byName.has(skill.name)) {
        byName.set(skill.name, skill.monthsOverride);
      }
    }
  }
  return [...byName].map(([skillName, months]) => ({ skillName, months }));
};

/**
 * 選んだ写し元がすべて読めたか。開いた後に消えた行があれば false。作るときと足すときに、
 * 写す前に確かめる（FR-007・FR-041）
 */
export const hasAllSources = (sources: ResumeSources, selection: ResumeSelection): boolean =>
  sources.careers.length === new Set(selection.careerIds).size &&
  sources.projects.length === new Set(selection.projectIds).size &&
  sources.educations.length === new Set(selection.educationIds).size;

/** 写す組織名。公開用で秘匿化した行は秘匿化した組織名で、無ければ null */
const organizationNameFor = (
  source: { organizationName: string; organizationNameMasked: string | null; isMasked: boolean },
  audience: ResumeAudience,
): string | null =>
  audience === 'public' && source.isMasked
    ? source.organizationNameMasked
    : source.organizationName;

/** 作るときと、作ったあとに足すとき（FR-041）に、同じ写し方で写す行を返す */
export const buildResumeContent = (
  sources: ResumeSources,
  selection: ResumeSelection,
  audience: ResumeAudience,
): BuildResumeResult => {
  const isPublic = audience === 'public';
  const chosen = <T extends { id: number }>(rows: T[], ids: number[]) => {
    const set = new Set(ids);
    return rows.filter((row) => set.has(row.id));
  };
  // 公開用は、サイトに載せる行だけを写す（FR-016）
  const onSite = <T extends { status: 'draft' | 'published' }>(rows: T[]) =>
    isPublic ? rows.filter((row) => row.status === 'published') : rows;
  // 公開用で秘匿化した行は、本文と関連 URL を写さない（FR-017）
  const hides = (row: { isMasked: boolean }) => isPublic && row.isMasked;

  const careers = onSite(chosen(sources.careers, selection.careerIds));
  const projects = onSite(chosen(sources.projects, selection.projectIds));
  if ([...careers, ...projects].some((row) => organizationNameFor(row, audience) === null)) {
    return { ok: false, reason: 'masked-name-missing' };
  }

  return {
    ok: true,
    content: {
      careers: careers.map((career) => ({
        careerId: career.id,
        organizationName: organizationNameFor(career, audience) ?? '',
        role: career.role,
        period: career.period,
        description: hides(career) ? null : career.description,
        url: hides(career) ? null : career.url,
        isMasked: career.isMasked,
      })),
      projects: projects.map((project) => ({
        projectId: project.id,
        organizationName: organizationNameFor(project, audience) ?? '',
        kind: project.kind,
        title: hides(project) ? project.titleMasked : project.title,
        period: project.period,
        description: hides(project) ? null : project.description,
        url: hides(project) ? null : project.url,
        isMasked: project.isMasked,
        skills: [...new Set(project.skills.map((skill) => skill.name))],
      })),
      educations: chosen(sources.educations, selection.educationIds).map((education) => ({
        educationId: education.id,
        school: education.school,
        department: education.department,
        period: education.period,
        remarks: education.remarks,
      })),
      skillOverrides: collectOverrides(projects),
    },
  };
};
