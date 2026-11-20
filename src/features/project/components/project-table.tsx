import Link from 'next/link';
import type { ProjectSummary } from '@/features/project/domain/project';
import { cn } from '@/lib/utils';
import { formatPeriod } from '@/shared/domain/period';
import { PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';

/**
 * 実績のコレクションの表。1 行を選ぶと、右のペインにその実績のシングルが出る。選んだ行の強調を
 * 保つ（HIG Split views）。列は見比べる属性に絞る
 */
export const ProjectTable = ({
  projects,
  selectedUid,
  hrefFor,
}: {
  projects: ProjectSummary[];
  selectedUid: string | null;
  hrefFor: (uid: string) => string;
}) => (
  <table className="w-full border-collapse text-small">
    <thead className="text-left text-caption text-muted-foreground">
      <tr>
        <th scope="col" className="px-3 py-2 font-medium">
          題
        </th>
        <th scope="col" className="px-3 py-2 font-medium">
          組織
        </th>
        <th scope="col" className="px-3 py-2 font-medium">
          種類
        </th>
        <th scope="col" className="px-3 py-2 font-medium">
          期間
        </th>
      </tr>
    </thead>
    <tbody>
      {projects.map((project) => {
        const selected = project.uid === selectedUid;
        return (
          <tr
            key={project.uid}
            className={cn(
              'relative border-t border-border/60',
              selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/70',
            )}
          >
            <td className="px-3 py-2.5">
              {/* 行全体を押せるよう、リンクを行に広げる */}
              <Link
                href={hrefFor(project.uid)}
                aria-current={selected ? 'true' : undefined}
                scroll={false}
                className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
              >
                {project.title}
              </Link>
            </td>
            <td className="px-3 py-2.5">{project.organizationName}</td>
            <td className="whitespace-nowrap px-3 py-2.5">{PROJECT_KIND_LABELS[project.kind]}</td>
            <td
              className={cn(
                'whitespace-nowrap px-3 py-2.5 tabular-nums',
                !selected && 'text-muted-foreground',
              )}
            >
              {formatPeriod(project.period)}
              {project.period.endedOn === null && '（継続中）'}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
