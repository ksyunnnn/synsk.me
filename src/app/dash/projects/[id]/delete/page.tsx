import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteProjectForm } from '@/features/project/components/delete-project-form';
import { deleteProject } from '@/features/project/server/actions';
import { getProjectForEdit } from '@/features/project/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、実績を読む前に 403 になる
  const project = await getProjectForEdit((await params).id);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">実績を削除する</h1>
      <p>
        次の実績を削除します。訪問者のページは見つからなくなり、戻せません。作った職務経歴書の中身は残ります。
      </p>
      <p>題: {project.title}</p>
      <DeleteProjectForm action={deleteProject} projectId={project.id} />
      <p>
        <Link
          href={`/dash/projects/${project.id}`}
          className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          編集の画面へ戻る
        </Link>
      </p>
    </main>
  );
};

export default Page;
