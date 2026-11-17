import type { ReactNode } from 'react';
import { PrintButton } from '@/features/resume/components/print-button';
import type { VisitorResume } from '@/features/resume/domain/visitor-resume';
import { fontFamily, sourceSans } from '@/lib/fonts';
import { MarkdownBody } from '@/shared/components/markdown-body';
import type { MediaStorageKey } from '@/shared/domain/media';
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
 *
 * 中身は 1280px の幅の組みだけを持ち、画面の幅に合わせて組み替えない。狭い画面ではページの
 * viewport（src/app/resume/[slug]/page.tsx）が全体を縮める。印刷も同じ組みのまま、A4 の
 * 印刷できる幅（用紙と余白は globals.css。210mm − 25mm − 15mm = 170mm ≒ 642px）に収まるよう
 * 全体を 0.5 倍に縮める。印刷で隠すのは上の帯だけ。背景と区切り線も画面と同じに刷る。
 *
 * 色と寸法はデザインの値を直に書いている。トークンにまだ無い値のため。
 *
 * 自己紹介と学歴の補足は、書式を持たない文字列として改行だけを残して出す。職歴と実績の本文は
 * Markdown として描き、本文の画像は `mediaSrc` が返す URL で出す。
 *
 * メールアドレスは、環境変数で渡したときだけ出す。スパム対策（FR-035）は plan.md の U8 で
 * 決まっておらず、本番の応答で Email Address Obfuscation が効くかを確かめる（tasks.md の T072）
 */

/** デザインの文字の段（Quiet / Display・Heading・Body・Caption）。どれも Light 300。名前（h1）だけ Regular 400 */
const DISPLAY = 'text-[40px] leading-[56px]';
const HEADING = 'text-[28px] leading-[42px]';
const BODY = 'text-[16px] leading-[28px]';
const CAPTION = 'text-[14px] leading-[24px]';

const PRIMARY = 'text-[#242424]';
const SECONDARY = 'text-[#686868]';

/**
 * 印刷で、まとまりを途中で切らず、直後でも改ページしない（見出しや項目の頭だけがページの末に
 * 残らないようにする）。長い本文は途中で切ってよい。break-after は Chrome だけが効き、Safari と
 * Firefox は効かない（MDN の break-after の互換表）
 */
const KEEP_WITH_NEXT = 'break-inside-avoid break-after-avoid';

/** 区切り線。背景色は印刷の既定で刷られないため、線で描く */
const Divider = () => <hr aria-hidden className="w-full border-0 border-t border-[#dedede]" />;

const Body = ({ text, className = '' }: { text: string | null; className?: string }) =>
  text ? <p className={`whitespace-pre-line ${className}`}>{text}</p> : null;

/** 職歴・実績の本文。Markdown として描く */
const MarkdownText = ({
  text,
  mediaSrc,
}: {
  text: string | null;
  mediaSrc: (storageKey: MediaStorageKey) => string | null;
}) =>
  text ? (
    <div
      className={`flex flex-col gap-4 ${BODY} [&_figcaption]:text-[14px] [&_figcaption]:leading-[24px] [&_figcaption]:text-[#686868] [&_figure]:flex [&_figure]:flex-col [&_figure]:gap-2 [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6`}
    >
      <MarkdownBody body={text} mediaSrc={mediaSrc} />
    </div>
  ) : null;

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

/** 生年月日（暦の日付 `YYYY-MM-DD`）を「1992年2月23日生」にする */
const toBirthDateText = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日生`;
};

/** 期間を 2 行で表す。1 行目に始まり、2 行目に「— 終わり」 */
const StackedPeriod = ({ period }: { period: Period }) => (
  <>
    <time dateTime={period.startedOn}>{toMonthText(period.startedOn)}</time>
    <span>
      {'— '}
      {period.endedOn ? (
        <time dateTime={period.endedOn}>{toMonthText(period.endedOn)}</time>
      ) : (
        '現在'
      )}
    </span>
  </>
);

/** 経験年数。年と月で表す（001 の FR-034） */
const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  if (years === 0) return `${rest} か月`;
  return rest === 0 ? `${years} 年` : `${years} 年 ${rest} か月`;
};

/** 右の列の節。見出しの下に中身 */
const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="flex flex-col gap-12">
    <h2 className={`${HEADING} ${PRIMARY} ${KEEP_WITH_NEXT}`}>{title}</h2>
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
  <section id={id} className="flex flex-col gap-4">
    <div className={`flex flex-col gap-6 ${KEEP_WITH_NEXT}`}>
      <Divider />
      <h2 className={`${BODY} ${PRIMARY}`}>{title}</h2>
    </div>
    {children}
  </section>
);

type Props = {
  resume: VisitorResume;
  /** 上の帯の左端に置く操作（管理画面の「設定の画面へ戻る」など） */
  toolbarStart?: ReactNode;
  /** 結びの右端に置く操作（訪問者の「トップへ戻る」など） */
  footerEnd?: ReactNode;
  /** 本文の画像の URL を作る。渡さなければ本文の画像を出さない */
  mediaSrc?: (storageKey: MediaStorageKey) => string | null;
};

const hideMedia = () => null;

export const VisitorResumeView = ({
  resume,
  toolbarStart,
  footerEnd,
  mediaSrc = hideMedia,
}: Props) => {
  const { profile } = resume;
  const index = [
    { id: 'careers', title: '職歴', count: resume.careers.length },
    { id: 'projects', title: '実績', count: resume.projects.length },
    { id: 'skills', title: 'スキル', count: resume.skills.length },
    { id: 'educations', title: '学歴', count: resume.educations.length },
  ].filter((item) => item.count > 0);

  return (
    // 書体は design/foundations.pen の font-en と font-ja
    <div className={sourceSans.className} style={{ fontFamily }}>
      <div className="border-b print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-2">
          <div>{toolbarStart}</div>
          <PrintButton />
        </div>
      </div>

      <div
        className={`bg-[#fafafa] font-light ${PRIMARY} print:[print-color-adjust:exact] print:[zoom:0.5]`}
      >
        {/* 空白の無い長い文字列（本文の URL など）は列の幅で折り返し、横にはみ出させない */}
        <article className="mx-auto w-[1280px] [overflow-wrap:anywhere]">
          <header className="flex flex-col gap-8 px-16 pt-12 pb-12">
            {/* 写真は名前の上端にそろえる */}
            <div className="flex items-start gap-16">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {/* 名前と肩書きを 1 つのまとまりにする */}
                <div className="flex flex-col gap-2">
                  <h1 className={`${DISPLAY} font-normal`}>{profile.name}</h1>
                  <Body text={profile.introduction} className={BODY} />
                </div>
                {/* 属性は添え書きの 1 行。区切りは実績の「種類 · 会社名」と同じ */}
                <p className={`${CAPTION} ${SECONDARY}`}>
                  <time dateTime={profile.birthDate}>{toBirthDateText(profile.birthDate)}</time>
                  {profile.email && (
                    <>
                      <span aria-hidden className="px-2">
                        ·
                      </span>
                      <a
                        href={`mailto:${profile.email}`}
                        className="underline rounded-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {profile.email}
                      </a>
                    </>
                  )}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- 写真は `public/` の 1 枚で、最適化の経路を通さない */}
              <img
                src={profile.photoSrc}
                alt={`${profile.name}の写真`}
                width={96}
                height={96}
                className="size-24 shrink-0 rounded-full border border-[#dedede] bg-[#f2f2f2] object-cover"
              />
            </div>
            <Divider />
          </header>

          <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-24 px-16">
            <aside className="flex flex-col gap-16">
              <nav aria-label="目次" className={`flex flex-col gap-4 ${CAPTION}`}>
                <p className={`${BODY} ${PRIMARY}`}>目次</p>
                <ol className="flex flex-col gap-2">
                  {index.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="flex items-center gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0 flex-1">{item.title}</span>
                        <span className={SECONDARY}>{item.count}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              {resume.skills.length > 0 && (
                <SideSection id="skills" title="スキル">
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
                <SideSection id="educations" title="学歴">
                  <ol className="flex flex-col gap-6">
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

            <div className="flex min-w-0 flex-col gap-32">
              {resume.careers.length > 0 && (
                <Section id="careers" title="職歴">
                  <ol className="flex flex-col gap-16">
                    {resume.careers.map((career, i) => (
                      // 期間を左の細い列に吊るし、左端を縦に追うと年だけを拾えるようにする
                      <li key={i} className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-8">
                        <p className={`flex flex-col ${CAPTION} ${SECONDARY}`}>
                          <StackedPeriod period={career.period} />
                        </p>
                        <div className="flex min-w-0 flex-col gap-4">
                          <div className={`flex flex-col gap-2 ${KEEP_WITH_NEXT}`}>
                            <h3 className={BODY}>{career.organizationName}</h3>
                            <p className={`${CAPTION} ${SECONDARY}`}>{career.role}</p>
                          </div>
                          <MarkdownText text={career.body} mediaSrc={mediaSrc} />
                          <ExternalLink href={career.url} />
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {resume.projects.length > 0 && (
                <Section id="projects" title="実績">
                  <ol className="flex flex-col gap-16">
                    {resume.projects.map((project, i) => (
                      <li key={i} className="flex flex-col gap-4">
                        <div className={`flex flex-col gap-6 ${KEEP_WITH_NEXT}`}>
                          <div className="flex flex-col gap-2">
                            <p className={`${CAPTION} ${SECONDARY}`}>
                              <ResumePeriod period={project.period} />
                            </p>
                            <h3 className={HEADING}>{project.title}</h3>
                            {/* 種類を先頭に「 · 」でつなぐ（Frank Chimero の「Book · 2012」の型）。下の技術の一覧（/ 区切り）と記号で分ける */}
                            <p className={`${CAPTION} ${SECONDARY}`}>
                              {PROJECT_KIND_LABELS[project.kind]}
                              <span aria-hidden className="px-2">
                                ·
                              </span>
                              {project.organizationName}
                            </p>
                          </div>
                        </div>
                        {project.skills.length > 0 && (
                          <p className={`${CAPTION} ${SECONDARY}`}>{project.skills.join(' / ')}</p>
                        )}
                        <MarkdownText text={project.body} mediaSrc={mediaSrc} />
                        <ExternalLink href={project.url} />
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-6 px-16 pt-24 pb-16 break-inside-avoid">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className={BODY}>{profile.name}</p>
              <p className={`${CAPTION} ${SECONDARY}`}>職務経歴書</p>
            </div>
            {footerEnd}
          </footer>
        </article>
      </div>
    </div>
  );
};
