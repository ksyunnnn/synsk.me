import Link from 'next/link';
import type { Metadata } from 'next';
import { ProjectForm } from '@/features/project/components/project-form';
import { toProjectFormValues } from '@/features/project/domain/project';
import { registerProject } from '@/features/project/server/actions';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（作り手の確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <Link
          href="/dash/projects"
          className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          実績の一覧へ戻る
        </Link>
      </p>
      <h1 className="text-2xl font-bold">実績を登録する</h1>
      <ProjectForm action={registerProject} initialValues={toProjectFormValues()} />
    </main>
  );
};

export default Page;
