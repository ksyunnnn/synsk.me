import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RESUME_UID_FIELD } from '@/features/resume/domain/resume-forms';
import { deleteResume } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">職務経歴書を削除する</h1>
      <p>
        次の職務経歴書を削除します。戻せません。渡した URL
        は読めなくなります。元の職歴・実績・学歴は残ります。
      </p>
      <p>{resume.title}</p>
      <DeleteForm
        action={deleteResume}
        uidField={RESUME_UID_FIELD}
        uid={resume.uid}
        messages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={`/dash/resumes/${resume.uid}`}>設定の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
