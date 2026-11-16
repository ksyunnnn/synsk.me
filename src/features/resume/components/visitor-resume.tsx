import type { ReactNode } from 'react';
import { PrintButton } from '@/features/resume/components/print-button';
import type { VisitorResume } from '@/features/resume/domain/visitor-resume';
import { fontFamily, sourceSans } from '@/lib/fonts';
import type { Period } from '@/shared/domain/period';
import { toYearsAndMonths } from '@/shared/domain/period';
import { PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';

/**
 * 訪問者に見せる職務経歴書（specs/002-resume/contracts/visitor-resume.md）。受け取った DTO の値
 * だけを描画する。管理画面の「訪問者に見せたときの見た目」も同じ部品で描く。「PDF で保存」の
 * ボタンでブラウザの印刷を開く（research.md の R11）。
 *
 * 上の帯にページの操作（「PDF で保存」）を置き、職務経歴書の中身と分ける。中身の見た目は Figma の
 * 「職務経歴書 — Quiet resume」（file yhHrXDTtvF7CjkLCeOZOU8、node 30:2）の Profile から下に従う。
 * 上にプロフィール、その下は 2 列で、左に目次・スキル・学歴、右に職歴・実績を置き、最後に結びを置く。
 * 幅は 1280px で固定し、画面の幅に合わせて組み替えない。
 *
 * 色と寸法はデザインの値を直に書いている。トークンにまだ無い値のため。
 *
 * 印刷は A4 縦（用紙と余白は globals.css）。本文は 10.5pt にする（厚生労働省・ハローワーク
 * 『職務経歴書の作り方』の「本文部分で 10.5〜12 ポイント程度」）。印刷での左の列の幅 50mm は
 * 選んだ値で、出典はない。スキルの行（スキル名と経験年数）が 1 行に収まる幅として選んだ。
 *
 * 本文の書式は plan.md の U4 で決まっていない。決まるまでの仮の形として、本文は書式を持たない
 * 文字列として改行だけを残して出す。本文の画像は出さない。
 *
 * メールアドレスは、環境変数で渡したときだけ出す。スパム対策（FR-035）は plan.md の U8 で
 * 決まっておらず、本番の応答で Email Address Obfuscation が効くかを確かめる（tasks.md の T072）
 */

/** デザインの文字の段（Quiet / Display・Heading・Body・Caption）。どれも Light 300 */
const DISPLAY = 'text-[64px] leading-[88px] print:text-[18pt] print:leading-normal';
const HEADING = 'text-[36px] leading-[54px] print:text-[13pt] print:leading-normal';
const BODY = 'text-[20px] leading-[36px] print:text-[10.5pt] print:leading-normal';
const CAPTION = 'text-[16px] leading-[28px] print:text-[10.5pt] print:leading-normal';

const PRIMARY = 'text-[#242424]';
const SECONDARY = 'text-[#686868]';

/**
 * 節の見出し。印刷では節をまるごと次のページへ送らず、項目（li）1 つずつを切らないようにする。
 * 見出しだけがページの末に残らないよう、見出しの直後で改ページしない指定を付ける。この指定は
 * Chrome だけが効き、Safari と Firefox は効かない（MDN の break-after の互換表）
 */
const HEADING_PRINT = 'print:break-after-avoid';

const Divider = () => <div aria-hidden className="h-px w-full bg-[#dedede]" />;

const Body = ({ text, className = '' }: { text: string | null; className?: string }) =>
  text ? <p className={`whitespace-pre-line ${className}`}>{text}</p> : null;

const ExternalLink = ({ href }: { href: string | null }) =>
  href ? (
    <p className={`${CAPTION} ${SECONDARY}`}>
      <a
        href={href}
        rel="noopener noreferrer"
        className="underline rounded-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {href}
      </a>
    </p>
  ) : null;

/** 期間の月。`YYYY-MM-DD` を `YYYY.MM` にする */
const toMonthText = (date: string) => `${date.slice(0, 4)}.${date.slice(5, 7)}`;

/** 期間。`YYYY.MM — YYYY.MM`。続いている期間の終わりは「現在」 */
const ResumePeriod = ({ period }: { period: Period }) => (
  <>
    <time dateTime={period.startedOn}>{toMonthText(period.startedOn)}</time>
    {' — '}
    {period.endedOn ? <time dateTime={period.endedOn}>{toMonthText(period.endedOn)}</time> : '現在'}
  </>
);

/** 経験年数。年と月で表す（001 の FR-034） */
const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  if (years === 0) return `${rest} か月`;
  return rest === 0 ? `${years} 年` : `${years} 年 ${rest} か月`;
};

/** 右の列の節。上に番号・英語名・件数、その下に見出し */
const Section = ({
  id,
  label,
  title,
  count,
  children,
}: {
  id: string;
  label: string;
  title: string;
  count: number;
  children: ReactNode;
}) => (
  <section id={id} className="flex flex-col gap-12 print:gap-4">
    <div className={`flex flex-col gap-2 ${HEADING_PRINT}`}>
      <p className={`flex gap-6 ${CAPTION} ${SECONDARY}`}>
        <span className="min-w-0 flex-1">{label}</span>
        <span className="whitespace-nowrap">{count} 件</span>
      </p>
      <h2 className={`${HEADING} ${PRIMARY}`}>{title}</h2>
    </div>
    {children}
  </section>
);

/** 左の列の節。区切り線の下に見出し */
const SideSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) => (
  <section id={id} className="flex flex-col gap-6 print:gap-4">
    <Divider />
    <h2 className={`${BODY} ${PRIMARY} ${HEADING_PRINT}`}>{title}</h2>
    {children}
  </section>
);

type Props = {
  resume: VisitorResume;
  /** 上の帯の左端に置く操作（管理画面の「設定の画面へ戻る」など） */
  toolbarStart?: ReactNode;
  /** 結びの右端に置く操作（訪問者の「トップへ戻る」など）。印刷には出さない */
  footerEnd?: ReactNode;
};

export const VisitorResumeView = ({ resume, toolbarStart, footerEnd }: Props) => {
  const { profile } = resume;
  const index = [
    { id: 'careers', title: '職歴', count: resume.careers.length },
    { id: 'projects', title: '実績', count: resume.projects.length },
    { id: 'skills', title: 'スキル', count: resume.skills.length },
    { id: 'educations', title: '学歴', count: resume.educations.length },
  ].filter((item) => item.count > 0);
  const numberOf = (id: string) =>
    String(index.findIndex((item) => item.id === id) + 1).padStart(2, '0');

  return (
    // 書体は design/foundations.pen の font-en と font-ja
    <div className={sourceSans.className} style={{ fontFamily }}>
      <div className="border-b print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-2">
          <div>{toolbarStart}</div>
          <PrintButton />
        </div>
      </div>

      <div className={`bg-[#fafafa] font-light ${PRIMARY} print:bg-transparent`}>
        <article className="mx-auto w-[1280px] print:w-auto">
          <header className="flex flex-col gap-12 px-16 pt-16 pb-24 print:gap-[6mm] print:p-0 print:pb-[8mm]">
            <div className="flex items-center gap-16 print:gap-[8mm]">
              <div className="flex min-w-0 flex-1 flex-col gap-6 print:gap-[3mm]">
                <h1 className={DISPLAY}>{profile.name}</h1>
                <Body text={profile.introduction} className={BODY} />
                {profile.email && (
                  <p className={`${CAPTION} ${SECONDARY}`}>
                    <a
                      href={`mailto:${profile.email}`}
                      className="underline rounded-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {profile.email}
                    </a>
                  </p>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- 写真は `public/` の 1 枚で、最適化の経路を通さない */}
              <img
                src={profile.photoSrc}
                alt={`${profile.name}の写真`}
                width={128}
                height={128}
                className="size-32 shrink-0 border border-[#dedede] bg-[#f2f2f2] object-cover print:size-[24mm]"
              />
            </div>
            <Divider />
          </header>

          <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-24 px-16 print:grid-cols-[50mm_minmax(0,1fr)] print:gap-[8mm] print:p-0">
            <aside className="flex flex-col gap-16 print:gap-[8mm]">
              <nav aria-label="目次" className={`flex flex-col gap-6 ${CAPTION} print:hidden`}>
                <p className={SECONDARY}>CONTENTS</p>
                <ol className="flex flex-col gap-6">
                  {index.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="flex items-center gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className={SECONDARY}>{numberOf(item.id)}</span>
                        <span className="min-w-0 flex-1">{item.title}</span>
                        <span className={SECONDARY}>{item.count}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              {resume.skills.length > 0 && (
                <SideSection id="skills" title={`${numberOf('skills')} / スキル`}>
                  <p className={`${CAPTION} ${SECONDARY}`}>実績から集計した経験期間</p>
                  <ul className={`flex flex-col gap-2 ${CAPTION}`}>
                    {resume.skills.map((skill) => (
                      <li key={skill.name} className="flex gap-2 break-inside-avoid">
                        <span className="min-w-0 flex-1">{skill.name}</span>
                        <span className={`whitespace-nowrap ${SECONDARY}`}>
                          {formatMonths(skill.months)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SideSection>
              )}

              {resume.educations.length > 0 && (
                <SideSection id="educations" title={`${numberOf('educations')} / 学歴`}>
                  <ol className="flex flex-col gap-6 print:gap-4">
                    {resume.educations.map((education, i) => (
                      <li key={i} className="flex flex-col gap-2 break-inside-avoid">
                        <h3 className={BODY}>{education.school}</h3>
                        {education.department && <p className={CAPTION}>{education.department}</p>}
                        <p className={`${CAPTION} ${SECONDARY}`}>
                          <ResumePeriod period={education.period} />
                        </p>
                        <Body text={education.remarks} className={`${CAPTION} ${SECONDARY}`} />
                      </li>
                    ))}
                  </ol>
                </SideSection>
              )}
            </aside>

            <div className="flex min-w-0 flex-col gap-24 print:gap-[8mm]">
              {resume.careers.length > 0 && (
                <Section
                  id="careers"
                  label={`${numberOf('careers')} / CAREER`}
                  title="職歴"
                  count={resume.careers.length}
                >
                  <ol className="flex flex-col gap-12 print:gap-6">
                    {resume.careers.map((career, i) => (
                      <li key={i} className="flex flex-col gap-6 break-inside-avoid print:gap-2">
                        <Divider />
                        <div className="flex flex-col gap-2">
                          <p className={`${CAPTION} ${SECONDARY}`}>
                            <ResumePeriod period={career.period} />
                          </p>
                          <h3 className={BODY}>{career.organizationName}</h3>
                          <p className={`${CAPTION} ${SECONDARY}`}>{career.role}</p>
                        </div>
                        <Body text={career.body} className={BODY} />
                        <ExternalLink href={career.url} />
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {resume.projects.length > 0 && (
                <Section
                  id="projects"
                  label={`${numberOf('projects')} / PROJECTS`}
                  title="実績"
                  count={resume.projects.length}
                >
                  <ol className="flex flex-col gap-12 print:gap-6">
                    {resume.projects.map((project, i) => (
                      <li key={i} className="flex flex-col gap-6 break-inside-avoid print:gap-2">
                        <Divider />
                        <div className="flex flex-col gap-2">
                          <p className={`flex gap-6 ${CAPTION} ${SECONDARY}`}>
                            <span className="min-w-0 flex-1">
                              <ResumePeriod period={project.period} />
                            </span>
                            <span className="whitespace-nowrap">
                              {PROJECT_KIND_LABELS[project.kind]}
                            </span>
                          </p>
                          <h3 className={HEADING}>{project.title}</h3>
                          <p className={`${CAPTION} ${SECONDARY}`}>{project.organizationName}</p>
                        </div>
                        {project.skills.length > 0 && (
                          <p className={`${CAPTION} ${SECONDARY}`}>{project.skills.join(' / ')}</p>
                        )}
                        <Body text={project.body} className={BODY} />
                        <ExternalLink href={project.url} />
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-6 px-16 pt-24 pb-16 print:hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className={BODY}>{profile.name}</p>
              <p className={`${CAPTION} ${SECONDARY}`}>職務経歴書 / RESUME</p>
            </div>
            {footerEnd}
          </footer>
        </article>
      </div>
    </div>
  );
};
