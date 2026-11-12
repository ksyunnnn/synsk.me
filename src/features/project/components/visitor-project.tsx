import type { VisitorProject } from '@/features/project/domain/project';
import { MarkdownBody } from '@/shared/components/markdown-body';
import { PeriodText } from '@/shared/components/period-text';
import { PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';
import { routes } from '@/shared/routes';

/**
 * 訪問者に見せる実績（specs/001-career-and-project/contracts/visitor-project.md）。
 * 受け取った DTO の値だけを描画する。秘匿化した実績の DTO は、本文・関連 URL・画像を持たない。
 *
 * 秘匿化しない実績の本文は、共有の Markdown の部品で出し、生の HTML を通さない（FR-023、plan.md の
 * U4）。本文の画像と代表画像は `/projects/{slug}/media/{key}` から出す（FR-030）。秘匿化した実績は、
 * 本文の場所に「非公開」と出す（FR-021）
 */

/** 実績の画像を配る経路 */
const projectMediaPath = (slug: string, storageKey: string) =>
  routes.projectMedia(slug, storageKey);

export const VisitorProjectView = ({ project }: { project: VisitorProject }) => (
  <article className="flex flex-col gap-6">
    <header className="flex flex-col gap-2">
      {!project.isMasked && project.cardImageKey && (
        // 画像は R2 の原本を変換せずに返す（U5 の決定）。next/image の変換を通さない。代表画像は飾りと
        // して出し、中身の説明は題と本文が持つ
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={projectMediaPath(project.slug, project.cardImageKey)}
          alt=""
          className="w-full rounded-md"
        />
      )}
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
    {!project.isMasked && project.body && (
      <section aria-labelledby="project-body-heading" className="flex flex-col gap-2">
        <h2 id="project-body-heading" className="text-sm text-muted-foreground">
          本文
        </h2>
        <MarkdownBody
          body={project.body}
          mediaSrc={(key) =>
            project.media.includes(key) ? projectMediaPath(project.slug, key) : null
          }
        />
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
