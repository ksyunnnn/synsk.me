import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProjectForm } from '@/features/project/components/project-form';
import { toProjectFormValues } from '@/features/project/domain/project';
import { editProject } from '@/features/project/server/actions';
import { getProjectForEdit, listSkillOptions } from '@/features/project/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { DraftSavedNotice } from '@/shared/components/draft-retention';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、実績を読む前に 403 になる
  const project = await getProjectForEdit((await params).id);
  if (!project) notFound();
  const [{ saved }, skillOptions] = await Promise.all([searchParams, listSkillOptions()]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/projects">実績の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績を編集する</h1>
      {saved === '1' && <DraftSavedNotice version={project.updatedAt} />}
      <p>
        <TextLink href={`/projects/${project.slug}`}>訪問者に見せるページを開く</TextLink>
      </p>
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <ProjectForm
        key={project.updatedAt}
        action={editProject}
        initialValues={toProjectFormValues(project)}
        skillOptions={skillOptions}
        project={{ uid: project.uid, updatedAt: project.updatedAt, isMasked: project.isMasked }}
      />
      <p>
        <TextLink href={`/dash/projects/${project.uid}/delete`}>この実績を削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
