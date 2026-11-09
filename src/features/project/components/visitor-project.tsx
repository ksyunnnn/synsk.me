import type { VisitorProject } from '@/features/project/domain/project';
import { PeriodText } from '@/shared/components/period-text';
import { PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';

/**
 * 訪問者に見せる実績（specs/001-career-and-project/contracts/visitor-project.md）。
 * 受け取った DTO の値だけを描画する。秘匿化した実績の DTO は、本文・関連 URL・画像を持たない。
 *
 * 本文は、Markdown の表示を作るまで出さない（tasks.md の T077）。秘匿化した実績は、本文の場所に
 * 「非公開」と出す（FR-021）。代表画像は、配る経路を作るまで出さない（tasks.md の T076）
 */

export const VisitorProjectView = ({ project }: { project: VisitorProject }) => (
  <article className="flex flex-col gap-6">
    <header className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{PROJECT_KIND_LABELS[project.kind]}</p>
      <h1 className="text-3xl font-bold">{project.title}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {project.organizationName && (
          <>
            <dt className="text-muted-foreground">組織</dt>
            <dd>{project.organizationName}</dd>
          </>
        )}
        <dt className="text-muted-foreground">期間</dt>
        <dd>
          <PeriodText period={project.period} />
        </dd>
        {project.skills.length > 0 && (
          <>
            <dt className="text-muted-foreground">スキル</dt>
            <dd>{project.skills.join('、')}</dd>
          </>
        )}
      </dl>
    </header>
    {project.isMasked && (
      <section aria-labelledby="project-body-heading" className="flex flex-col gap-2">
        <h2 id="project-body-heading" className="text-sm text-muted-foreground">
          本文
        </h2>
        <p>非公開</p>
      </section>
    )}
    {!project.isMasked && project.url && (
      <p>
        <a
          href={project.url}
          rel="noopener noreferrer"
          className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          関連するページ
        </a>
      </p>
    )}
  </article>
);
