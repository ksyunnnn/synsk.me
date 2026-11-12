import type { Metadata } from 'next';
import { ResumeCreateForm } from '@/features/resume/components/resume-create-form';
import { toSourceOptions } from '@/features/resume/components/resume-source-fieldset';
import { changeResumeStatusInPlace, createResume } from '@/features/resume/server/actions';
import { listResumeSources } from '@/features/resume/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書を作る | synsk.me' };

const Page = async () => {
  // オーナーでなければ、読む前に 403 になる
  const sources = await listResumeSources();

  // フォームには選択肢の名前だけを渡す。本文や関連 URL をクライアントの部品に渡さない
  return (
    <DashPage
      back={{ href: routes.dash.resumes.list, label: '職務経歴書の一覧へ戻る' }}
      title="職務経歴書を作る"
    >
      <ResumeCreateForm
        action={createResume}
        changeStatusAction={changeResumeStatusInPlace}
        {...toSourceOptions(sources)}
      />
    </DashPage>
  );
};

export default Page;
