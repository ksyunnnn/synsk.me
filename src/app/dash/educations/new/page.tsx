import type { Metadata } from 'next';
import { EducationForm } from '@/features/education/components/education-form';
import { toEducationFormValues } from '@/features/education/domain/education';
import { registerEducation } from '@/features/education/server/actions';
import { DashPage } from '@/shared/components/dash-page';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '学歴を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <DashPage
      back={{ href: routes.dash.educations.list, label: '学歴の一覧へ戻る' }}
      title="学歴を登録する"
    >
      <EducationForm action={registerEducation} initialValues={toEducationFormValues()} />
    </DashPage>
  );
};

export default Page;
