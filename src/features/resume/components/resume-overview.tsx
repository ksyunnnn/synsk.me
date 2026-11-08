import { RESUME_PROJECT_KIND_LABELS, type ResumeForEdit } from '@/features/resume/domain/resume';
import { listResumeSkills } from '@/features/resume/domain/resume-skills';
import { TextLink } from '@/shared/components/text-link';
import { toYearsAndMonths, type Period } from '@/shared/domain/period';

/**
 * 設定の画面の中身。写した職歴・実績・学歴・スキルの一覧と、各行の編集へのリンク、職歴・実績・
 * 学歴を足す画面へのリンク（FR-041。行が 0 件でも出す）
 * （specs/002-resume/contracts/dash.md の `/dash/resumes/{uid}`）
 */

const periodText = (period: Period) => `${period.startedOn} 〜 ${period.endedOn ?? ''}`;

const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  return `${years} 年 ${rest} か月`;
};

export const ResumeOverview = ({ resume, now }: { resume: ResumeForEdit; now: Date }) => {
  const skills = listResumeSkills(resume.projects, resume.skillOverrides, now);
  const overridden = new Set(resume.skillOverrides.map((o) => o.skillName));
  const base = `/dash/resumes/${resume.uid}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">職歴（{resume.careers.length} 件）</h2>
        <p>
          <TextLink href={`${base}/careers/new`}>職歴を足す</TextLink>
        </p>
        <ul className="flex flex-col gap-2">
          {resume.careers.map((career) => (
            <li key={career.id} className="flex flex-col">
              <TextLink href={`${base}/careers/${career.uid}`}>
                {career.organizationName}・{career.role}
              </TextLink>
              <span className="text-sm text-muted-foreground">{periodText(career.period)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">実績（{resume.projects.length} 件）</h2>
        <p>
          <TextLink href={`${base}/projects/new`}>実績を足す</TextLink>
        </p>
        <ul className="flex flex-col gap-2">
          {resume.projects.map((project) => (
            <li key={project.id} className="flex flex-col">
              <TextLink href={`${base}/projects/${project.uid}`}>{project.title}</TextLink>
              <span className="text-sm text-muted-foreground">
                {RESUME_PROJECT_KIND_LABELS[project.kind]}・{project.organizationName}・
                {periodText(project.period)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">学歴（{resume.educations.length} 件）</h2>
        <p>
          <TextLink href={`${base}/educations/new`}>学歴を足す</TextLink>
        </p>
        <ul className="flex flex-col gap-2">
          {resume.educations.map((education) => (
            <li key={education.id} className="flex flex-col">
              <TextLink href={`${base}/educations/${education.uid}`}>{education.school}</TextLink>
              <span className="text-sm text-muted-foreground">{periodText(education.period)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">スキル（{skills.length} 件）</h2>
        <ul className="flex flex-col gap-1">
          {skills.map((skill) => (
            <li key={skill.name}>
              {skill.name}・{formatMonths(skill.months)}
              {overridden.has(skill.name) && (
                <span className="text-sm text-muted-foreground">（上書き）</span>
              )}
            </li>
          ))}
        </ul>
        <p>
          <TextLink href={`${base}/skills`}>経験年数の上書きを直す</TextLink>
        </p>
      </section>
    </div>
  );
};
