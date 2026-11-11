import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteProjectForm } from '@/features/project/components/delete-project-form';
import { deleteProject } from '@/features/project/server/actions';
import { getProjectForEdit } from '@/features/project/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、実績を読む前に 403 になる
  const project = await getProjectForEdit((await params).id);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">実績を削除する</h1>
      <p>
        次の実績を削除します。訪問者のページは見つからなくなり、戻せません。作った職務経歴書の中身は残ります。
      </p>
      <p>題: {project.title}</p>
      <DeleteProjectForm action={deleteProject} projectUid={project.uid} />
      <p>
        <TextLink href={routes.dash.projects.row(project.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
