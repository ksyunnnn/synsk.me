import type { Metadata } from 'next';
import { ExternalActivityForm } from '@/features/activity/components/external-activity-form';
import { toExternalActivityFormValues } from '@/features/activity/domain/external-activity';
import { registerExternalActivity } from '@/features/activity/server/actions';
import { DashPage } from '@/shared/components/dash-page';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <DashPage
      back={{ href: routes.dash.activities.list, label: '外部の activity の一覧へ戻る' }}
      title="外部の activity を登録する"
    >
      <ExternalActivityForm
        action={registerExternalActivity}
        initialValues={toExternalActivityFormValues()}
      />
    </DashPage>
  );
};

export default Page;
