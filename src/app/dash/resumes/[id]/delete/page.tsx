import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RESUME_UID_FIELD } from '@/features/resume/domain/resume-forms';
import { deleteResume } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

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
    <DashPage title="職務経歴書を削除する">
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
        <TextLink href={routes.dash.resumes.row(resume.uid)}>設定の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
