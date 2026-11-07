import type { Metadata } from 'next';
import { PROJECT_KIND_LABELS } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { SITE_STATUS_LABELS } from '@/shared/domain/site-status';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // 作り手でなければ、読む前に 403 になる
  const projects = await listProjects();
  const { deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績</h1>
      {deleted === '1' && <p role="status">実績を削除しました</p>}
      <p>
        <TextLink href="/dash/projects/new">実績を登録する</TextLink>
      </p>
      {projects.length === 0 ? (
        <p>登録した実績はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-col">
              <TextLink href={`/dash/projects/${project.id}`}>{project.title}</TextLink>
              <span className="text-sm text-muted-foreground">
                {PROJECT_KIND_LABELS[project.kind]}・{project.organizationName}・
                {project.period.startedOn} 〜 {project.period.endedOn ?? ''}・
                {SITE_STATUS_LABELS[project.status]}・
                {project.isMasked ? '秘匿化する' : '秘匿化しない'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
