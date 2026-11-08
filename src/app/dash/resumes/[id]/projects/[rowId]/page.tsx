import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeProjectForm } from '@/features/resume/components/resume-row-forms';
import { toResumeProjectFormValues } from '@/features/resume/domain/resume-forms';
import { editResumeProject } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '写した実績を直す | synsk.me' };

type Props = { params: Promise<{ id: string; rowId: string }> };

const Page = async ({ params }: Props) => {
  const { id, rowId } = await params;
  // 作り手でなければ、読む前に 403 になる
  const resume = await getResumeForEdit(id);
  const project = resume?.projects.find((row) => row.uid === rowId);
  if (!resume || !project) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={`/dash/resumes/${resume.uid}`}>設定の画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">写した実績を直す</h1>
      <p className="text-sm text-muted-foreground">
        直した値はこの職務経歴書にだけ効きます。元の実績は変わりません
      </p>
      <ResumeProjectForm
        key={resume.updatedAt}
        action={editResumeProject}
        initialValues={toResumeProjectFormValues(project)}
        target={{ resumeUid: resume.uid, rowUid: project.uid, updatedAt: resume.updatedAt }}
      />
    </main>
  );
};

export default Page;
