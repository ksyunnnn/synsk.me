import type { ReactNode } from 'react';
import { PrintButton } from '@/features/resume/components/print-button';
import { RESUME_PROJECT_KIND_LABELS } from '@/features/resume/domain/resume';
import type { VisitorResume } from '@/features/resume/domain/visitor-resume';
import { fontFamily, sourceSans } from '@/lib/fonts';
import { toYearsAndMonths, type Period } from '@/shared/domain/period';

/**
 * 訪問者に見せる職務経歴書（specs/002-resume/contracts/visitor-resume.md）。受け取った DTO の値
 * だけを描画する。管理画面の「訪問者に見せたときの見た目」も同じ部品で描く。「PDF で保存」の
 * ボタンでブラウザの印刷を開く（research.md の R11）。
 *
 * 上の帯にページの操作（「PDF で保存」）を置き、職務経歴書の中身と分ける。中身は 2 列で、左に
 * 写真・氏名・連絡先・スキル・学歴、右に自己紹介・職歴・実績を置く。狭い画面では 1 列に積む。
 *
 * 印刷は A4 縦（用紙と余白は globals.css）。本文は 10.5pt にする（厚生労働省・ハローワーク
 * 『職務経歴書の作り方』の「本文部分で 10.5〜12 ポイント程度」）。写真は証明写真ではなく、
 * プロフィールの画像として丸く切り抜いて出す。印刷での左の列の幅 50mm は選んだ値で、出典はない。
 * スキルの行（スキル名と経験年数）が 1 行に収まる幅として選んだ。
 *
 * 本文の書式は plan.md の U4 で決まっていない。決まるまでの仮の形として、本文は書式を持たない
 * 文字列として改行だけを残して出す。本文の画像は出さない。
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

/** 補足の行（役職・期間など）。印刷では本文と同じ大きさにする */
const META = 'text-sm text-muted-foreground print:text-[10.5pt]';

/**
 * 節の見出し。印刷では節をまるごと次のページへ送らず、項目（li）1 つずつを切らないようにする。
 * 見出しだけがページの末に残らないよう、見出しの直後で改ページしない指定を付ける。この指定は
 * Chrome だけが効き、Safari と Firefox は効かない（MDN の break-after の互換表）
 */
const HEADING_PRINT = 'print:break-after-avoid';

/** 右の列の節 */
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-6 print:gap-4">
    <h2
      className={`text-xl font-semibold print:border-b print:pb-2 print:text-[13pt] ${HEADING_PRINT}`}
    >
      {title}
    </h2>
    {children}
  </section>
);

/** 左の列の節 */
const SideSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-6 print:gap-4">
    <h2
      className={`text-base font-semibold print:border-b print:pb-2 print:text-[11pt] ${HEADING_PRINT}`}
    >
      {title}
    </h2>
    {children}
  </section>
);

type Props = {
  resume: VisitorResume;
  /** 上の帯の左端に置く操作（管理画面の「設定の画面へ戻る」など） */
  toolbarStart?: ReactNode;
};

export const VisitorResumeView = ({ resume, toolbarStart }: Props) => {
  const { profile } = resume;
  return (
    // 書体は design/foundations.pen の font-en と font-ja
    <div className={sourceSans.className} style={{ fontFamily }}>
      <div className="border-b print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-2">
          <div>{toolbarStart}</div>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto grid max-w-5xl gap-24 px-6 pt-12 pb-24 leading-[1.8] md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] print:max-w-none print:grid-cols-[50mm_minmax(0,1fr)] print:gap-[8mm] print:p-0 print:text-[10.5pt] print:leading-normal">
        <aside className="flex flex-col gap-24 print:gap-[8mm]">
          <header className="flex flex-col gap-6 print:gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- 写真は `public/` の 1 枚で、最適化の経路を通さない */}
            <img
              src={profile.photoSrc}
              alt={`${profile.name}の写真`}
              width={96}
              height={96}
              className="size-24 rounded-full border object-cover print:size-[24mm]"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground print:text-[10.5pt]">職務経歴書</p>
              <h1 className="text-3xl font-semibold print:text-[18pt]">{profile.name}</h1>
            </div>
            {profile.email && (
              <p className="text-sm print:text-[10.5pt]">
                <a
                  href={`mailto:${profile.email}`}
                  className="underline underline-offset-4 rounded-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {profile.email}
                </a>
              </p>
            )}
          </header>

          {resume.skills.length > 0 && (
            <SideSection title="スキル">
              <ul className="flex flex-col gap-2 text-sm print:text-[10.5pt]">
                {resume.skills.map((skill) => (
                  <li key={skill.name} className="flex justify-between gap-4 break-inside-avoid">
                    <span className="min-w-0">{skill.name}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatMonths(skill.months)}
                    </span>
                  </li>
                ))}
              </ul>
            </SideSection>
          )}

          {resume.educations.length > 0 && (
            <SideSection title="学歴">
              <ol className="flex flex-col gap-6 text-sm print:gap-4 print:text-[10.5pt]">
                {resume.educations.map((education, index) => (
                  <li key={index} className="flex flex-col gap-2 break-inside-avoid">
                    <h3 className="font-semibold">
                      {education.school}
                      {education.department && ` ${education.department}`}
                    </h3>
                    <p className="text-muted-foreground">
                      <PeriodText period={education.period} />
                    </p>
                    <Body text={education.remarks} />
                  </li>
                ))}
              </ol>
            </SideSection>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-24 print:gap-[8mm]">
          <Body text={profile.introduction} />

          {resume.careers.length > 0 && (
            <Section title="職歴">
              <ol className="flex flex-col gap-12 print:gap-6">
                {resume.careers.map((career, index) => (
                  <li key={index} className="flex flex-col gap-2 break-inside-avoid">
                    <h3 className="text-lg font-semibold print:text-[11pt]">
                      {career.organizationName}
                    </h3>
                    <p className={META}>
                      {career.role}・<PeriodText period={career.period} />
                    </p>
                    <Body text={career.body} />
                    <ExternalLink href={career.url} />
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {resume.projects.length > 0 && (
            <Section title="実績">
              <ol className="flex flex-col gap-12 print:gap-6">
                {resume.projects.map((project, index) => (
                  <li key={index} className="flex flex-col gap-2 break-inside-avoid">
                    <h3 className="text-lg font-semibold print:text-[11pt]">{project.title}</h3>
                    <p className={META}>
                      {RESUME_PROJECT_KIND_LABELS[project.kind]}・{project.organizationName}・
                      <PeriodText period={project.period} />
                    </p>
                    {project.skills.length > 0 && (
                      <p className="text-sm print:text-[10.5pt]">{project.skills.join('、')}</p>
                    )}
                    <Body text={project.body} />
                    <ExternalLink href={project.url} />
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </article>
    </div>
  );
};
