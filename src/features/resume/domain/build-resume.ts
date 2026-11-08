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
 * FR-010）。写し元が秘匿化していたかは `isMasked` に写す（migration 0008）。公開用の分岐は
 * tasks.md の Phase 7（US5）で足すまで作らず、拒む
 */

export type BuildResumeResult =
  { ok: true; content: NewResumeContent } | { ok: false; reason: 'public-not-supported' };

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

/** 作るときと、作ったあとに足すとき（FR-041）に、同じ写し方で写す行を返す */
export const buildResumeContent = (
  sources: ResumeSources,
  selection: ResumeSelection,
  audience: ResumeAudience,
): BuildResumeResult => {
  if (audience !== 'limited') return { ok: false, reason: 'public-not-supported' };

  const chosen = <T extends { id: number }>(rows: T[], ids: number[]) => {
    const set = new Set(ids);
    return rows.filter((row) => set.has(row.id));
  };
  const projects = chosen(sources.projects, selection.projectIds);

  return {
    ok: true,
    content: {
      careers: chosen(sources.careers, selection.careerIds).map((career) => ({
        careerId: career.id,
        organizationName: career.organizationName,
        role: career.role,
        period: career.period,
        description: career.description,
        url: career.url,
        isMasked: career.isMasked,
      })),
      projects: projects.map((project) => ({
        projectId: project.id,
        organizationName: project.organizationName,
        kind: project.kind,
        title: project.title,
        period: project.period,
        description: project.description,
        url: project.url,
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
