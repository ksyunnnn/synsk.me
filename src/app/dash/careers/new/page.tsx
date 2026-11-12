import type { Metadata } from 'next';
import { CareerForm } from '@/features/career/components/career-form';
import { toCareerFormValues } from '@/features/career/domain/career';
import { registerCareer } from '@/features/career/server/actions';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  const organizationNames = await listOrganizationNames();
  return (
    <DashPage
      back={{ href: routes.dash.careers.list, label: '職歴の一覧へ戻る' }}
      title="職歴を登録する"
    >
      <CareerForm
        action={registerCareer}
        initialValues={toCareerFormValues()}
        organizationNames={organizationNames}
      />
    </DashPage>
  );
};

export default Page;
