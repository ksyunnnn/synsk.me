import type { ReactNode } from 'react';
import { PrintButton } from '@/features/resume/components/print-button';
import { RESUME_PROJECT_KIND_LABELS } from '@/features/resume/domain/resume';
import type { VisitorResume } from '@/features/resume/domain/visitor-resume';
import { toYearsAndMonths, type Period } from '@/shared/domain/period';

/**
 * 訪問者に見せる職務経歴書（specs/002-resume/contracts/visitor-resume.md）。受け取った DTO の値
 * だけを描画する。管理画面の「訪問者に見せたときの見た目」も同じ部品で描く。「PDF で保存」の
 * ボタンでブラウザの印刷を開く（research.md の R11）。
 *
 * 本文の書式は plan.md の U4 で決まっていない。決まるまでの仮の形として、本文は書式を持たない
 * 文字列として改行だけを残して出す。本文の画像は出さない。
 *
 * 公開用で秘匿化した職歴・実績は、本文の場所に「非公開」と出す（FR-017、plan.md の U5）。contact の
 * ページへのリンクは、contact のページができてから足す（tasks.md の T077）。
 *
 * メールアドレスは、環境変数で渡したときだけ出す。スパム対策（FR-035）は plan.md の U8 で
 * 決まっておらず、本番の応答で Email Address Obfuscation が効くかを確かめる（tasks.md の T072）
 */

const PeriodText = ({ period }: { period: Period }) => (
  <>
    <time dateTime={period.startedOn}>{period.startedOn}</time>
    {' 〜 '}
    {period.endedOn ? <time dateTime={period.endedOn}>{period.endedOn}</time> : '現在'}
  </>
);

const Body = ({ text }: { text: string | null }) =>
  text ? <p className="whitespace-pre-line">{text}</p> : null;

/** 公開用で秘匿化した行の本文の場所（FR-017）。中身を持たず、伏せたことだけを示す */
const MaskedBody = () => <p className="text-sm text-muted-foreground">非公開</p>;

const ExternalLink = ({ href }: { href: string | null }) =>
  href ? (
    <p>
      <a
        href={href}
        rel="noopener noreferrer"
        className="underline underline-offset-4 rounded-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {href}
      </a>
    </p>
  ) : null;

/** 経験年数。年と月で表す（001 の FR-034） */
const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  if (years === 0) return `${rest} か月`;
  return rest === 0 ? `${years} 年` : `${years} 年 ${rest} か月`;
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-4 break-inside-avoid-page">
    <h2 className="text-xl font-bold border-b pb-1">{title}</h2>
    {children}
  </section>
);

export const VisitorResumeView = ({ resume }: { resume: VisitorResume }) => {
  const { profile } = resume;
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{profile.name}</h1>
          <PrintButton />
        </div>
        {profile.email && (
          <p>
            <a
              href={`mailto:${profile.email}`}
              className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {profile.email}
            </a>
          </p>
        )}
        <Body text={profile.introduction} />
      </header>

      {resume.skills.length > 0 && (
        <Section title="スキル">
          <ul className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            {resume.skills.map((skill) => (
              <li key={skill.name} className="contents">
                <span>{skill.name}</span>
                <span className="text-muted-foreground">{formatMonths(skill.months)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.careers.length > 0 && (
        <Section title="職歴">
          <ol className="flex flex-col gap-6">
            {resume.careers.map((career, index) => (
              <li key={index} className="flex flex-col gap-2 break-inside-avoid">
                <h3 className="text-lg font-bold">{career.organizationName}</h3>
                <p className="text-sm text-muted-foreground">
                  {career.role}・<PeriodText period={career.period} />
                </p>
                {career.isMasked ? (
                  <MaskedBody />
                ) : (
                  <>
                    <Body text={career.body} />
                    <ExternalLink href={career.url} />
                  </>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {resume.projects.length > 0 && (
        <Section title="実績">
          <ol className="flex flex-col gap-6">
            {resume.projects.map((project, index) => (
              <li key={index} className="flex flex-col gap-2 break-inside-avoid">
                <h3 className="text-lg font-bold">{project.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {RESUME_PROJECT_KIND_LABELS[project.kind]}・{project.organizationName}・
                  <PeriodText period={project.period} />
                </p>
                {project.skills.length > 0 && (
                  <p className="text-sm">{project.skills.join('、')}</p>
                )}
                {project.isMasked ? (
                  <MaskedBody />
                ) : (
                  <>
                    <Body text={project.body} />
                    <ExternalLink href={project.url} />
                  </>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {resume.educations.length > 0 && (
        <Section title="学歴">
          <ol className="flex flex-col gap-4">
            {resume.educations.map((education, index) => (
              <li key={index} className="flex flex-col gap-1 break-inside-avoid">
                <h3 className="font-bold">
                  {education.school}
                  {education.department && ` ${education.department}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  <PeriodText period={education.period} />
                </p>
                <Body text={education.remarks} />
              </li>
            ))}
          </ol>
        </Section>
      )}
    </article>
  );
};
