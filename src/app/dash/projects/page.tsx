import type { Metadata } from 'next';
import Link from 'next/link';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { ProjectForm } from '@/features/project/components/project-form';
import {
  ProjectListFilters,
  describeProjectListFilter,
} from '@/features/project/components/project-list';
import { ProjectTable } from '@/features/project/components/project-table';
import { parseProjectListFilter, toProjectFormValues } from '@/features/project/domain/project';
import { editProject } from '@/features/project/server/actions';
import {
  getProjectForEdit,
  listProjects,
  listSkillOptions,
} from '@/features/project/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績 | synsk.me' };

type Param = string | string[] | undefined;

type Props = {
  searchParams: Promise<{
    deleted?: Param;
    selected?: Param;
    kind?: Param;
    org?: Param;
    status?: Param;
    masked?: Param;
  }>;
};

const first = (value: Param): string | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * 実績の Split view。左に実績のコレクション、右に選んだ 1 件のシングルを置く
 * （#366 の明文化の「2. ビュー」）
 */
const Page = async ({ searchParams }: Props) => {
  const { deleted, selected, ...params } = await searchParams;
  // オーナーでなければ、読む前に 403 になる
  const { projects, organizations, filter } = await listProjects(parseProjectListFilter(params));
  const conditions = describeProjectListFilter(filter, organizations);
  const selectedUid = first(selected);
  const [project, skillOptions, organizationNames] = await Promise.all([
    selectedUid === null ? null : getProjectForEdit(selectedUid),
    selectedUid === null ? [] : listSkillOptions(),
    selectedUid === null ? [] : listOrganizationNames(),
  ]);

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v) query.set(key, v);
  }
  const hrefFor = (uid: string) => {
    const next = new URLSearchParams(query);
    next.set('selected', uid);
    return `${routes.dash.projects.list}?${next}`;
  };

  return (
    <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
      <section aria-labelledby="projects-heading" className="relative min-w-0 rounded-3xl bg-background">
        {/* ツールバー。先頭に題と件数、末尾に主な操作を 1 つ置く（HIG Toolbars） */}
        <div className="glass sticky top-4 z-10 m-2 flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-5">
          <h1 id="projects-heading" className="font-semibold">
            実績
          </h1>
          <p aria-live="polite" className="text-small text-muted-foreground">
            {projects.length} 件{conditions.length > 0 && `・${conditions.join('・')}`}
          </p>
          <div
            role="group"
            aria-label="見せ方"
            className="ml-auto flex rounded-full bg-foreground/6 p-0.5 text-small"
          >
            <span aria-current="true" className="rounded-full bg-background px-3 py-1 font-medium shadow-sm">
              表
            </span>
            <span className="px-3 py-1 text-muted-foreground">時系列</span>
          </div>
          <Link
            href={routes.dash.projects.new}
            className="rounded-full bg-primary px-4 py-1.5 text-small font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            追加
          </Link>
        </div>
        {deleted === '1' && (
          <SavedNotice flags={['deleted']} className="px-5">
            実績を削除しました
          </SavedNotice>
        )}
        <details className="px-5 pb-2 text-small">
          <summary className="cursor-pointer text-muted-foreground">絞り込み</summary>
          <div className="pt-3">
            <ProjectListFilters filter={filter} organizations={organizations} />
            {conditions.length > 0 && (
              <p className="pt-2">
                <TextLink href={routes.dash.projects.list}>条件を外す</TextLink>
              </p>
            )}
          </div>
        </details>
        <div className="px-2 pb-4">
          {projects.length === 0 ? (
            <p className="px-3 py-6 text-muted-foreground">
              {conditions.length > 0 ? '条件に合う実績はありません' : '登録した実績はありません'}
            </p>
          ) : (
            <ProjectTable projects={projects} selectedUid={selectedUid} hrefFor={hrefFor} />
          )}
        </div>
      </section>

      <section
        aria-label="選んだ実績"
        className="min-w-0 rounded-3xl bg-background p-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
      >
        {project ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-heading-2 font-semibold tracking-heading">{project.title}</h2>
            <ProjectForm
              key={project.updatedAt}
              action={editProject}
              initialValues={toProjectFormValues(project)}
              organizationNames={organizationNames}
              skillOptions={skillOptions}
              project={{ uid: project.uid, updatedAt: project.updatedAt, isMasked: project.isMasked }}
            />
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">一覧から実績を選ぶと、ここに出ます</p>
        )}
      </section>
    </main>
  );
};

export default Page;
