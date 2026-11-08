import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeAddRows } from '@/features/resume/components/resume-add-rows';
import { addResumeRows } from '@/features/resume/server/actions';
import { getResumeForEdit, listResumeSources } from '@/features/resume/server/queries';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴を足す | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  return (
    <ResumeAddRows
      resume={resume}
      sources={await listResumeSources()}
      kind="careers"
      action={addResumeRows}
    />
  );
};

export default Page;
