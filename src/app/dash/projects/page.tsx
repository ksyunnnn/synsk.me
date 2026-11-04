import Link from 'next/link';
import type { Metadata } from 'next';
import { PROJECT_KIND_LABELS } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績 | synsk.me' };

const LINK =
  'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // 作り手でなければ、読む前に 403 になる
  const projects = await listProjects();
  const { deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <Link href="/dash" className={LINK}>
          管理画面へ戻る
        </Link>
      </p>
      <h1 className="text-2xl font-bold">実績</h1>
      {deleted === '1' && <p role="status">実績を削除しました</p>}
      <p>
        <Link href="/dash/projects/new" className={LINK}>
          実績を登録する
        </Link>
      </p>
      {projects.length === 0 ? (
        <p>登録した実績はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-col">
              <Link href={`/dash/projects/${project.id}`} className={LINK}>
                {project.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {PROJECT_KIND_LABELS[project.kind]}・{project.organizationName}・
                {project.period.startedOn} 〜 {project.period.endedOn ?? ''}・
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
