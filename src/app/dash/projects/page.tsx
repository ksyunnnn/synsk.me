import type { Metadata } from 'next';
import {
  ProjectListCard,
  ProjectListFilters,
  describeProjectListFilter,
} from '@/features/project/components/project-list';
import { parseProjectListFilter } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
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
    kind?: Param;
    org?: Param;
    status?: Param;
    masked?: Param;
  }>;
};

const Page = async ({ searchParams }: Props) => {
  const { deleted, ...params } = await searchParams;
  // オーナーでなければ、読む前に 403 になる
  const { projects, organizations, filter } = await listProjects(parseProjectListFilter(params));
  const conditions = describeProjectListFilter(filter, organizations);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.index}>管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績</h1>
      {deleted === '1' && <SavedNotice flags={['deleted']}>実績を削除しました</SavedNotice>}
      <p>
        <TextLink href={routes.dash.projects.new}>実績を登録する</TextLink>
      </p>
      <ProjectListFilters filter={filter} organizations={organizations} />
      {/* 絞り込みを変えたとき、読み上げにも件数の変化を伝える。選んでいる条件を並べ、まとめて外せる */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <p aria-live="polite">{projects.length} 件</p>
        {conditions.length > 0 && (
          <>
            <p>{conditions.join('・')}</p>
            <TextLink href={routes.dash.projects.list}>条件を外す</TextLink>
          </>
        )}
      </div>
      {projects.length === 0 ? (
        <p>{conditions.length > 0 ? '条件に合う実績はありません' : '登録した実績はありません'}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectListCard key={project.id} project={project} />
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
