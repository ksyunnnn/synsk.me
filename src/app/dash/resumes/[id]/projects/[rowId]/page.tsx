import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeProjectForm } from '@/features/resume/components/resume-row-forms';
import { toResumeProjectFormValues } from '@/features/resume/domain/resume-forms';
import { editResumeProject } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '写した実績を直す | synsk.me' };

type Props = { params: Promise<{ id: string; rowId: string }> };

const Page = async ({ params }: Props) => {
  const { id, rowId } = await params;
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit(id);
  const project = resume?.projects.find((row) => row.uid === rowId);
  if (!resume || !project) notFound();

  return (
    <DashPage
      back={{ href: routes.dash.resumes.row(resume.uid), label: '設定の画面へ戻る' }}
      title="写した実績を直す"
    >
      <p className="text-sm text-muted-foreground">
        直した値はこの職務経歴書にだけ効きます。元の実績は変わりません
      </p>
      <ResumeProjectForm
        key={resume.updatedAt}
        action={editResumeProject}
        initialValues={toResumeProjectFormValues(project)}
        target={{ resumeUid: resume.uid, rowUid: project.uid, updatedAt: resume.updatedAt }}
      />
    </DashPage>
  );
};

export default Page;
