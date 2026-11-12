import type { Metadata } from 'next';
import { LifeEventForm } from '@/features/activity/components/life-event-form';
import { toLifeEventFormValues } from '@/features/activity/domain/life-event';
import { registerLifeEvent } from '@/features/activity/server/actions';
import { DashPage } from '@/shared/components/dash-page';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event を作る | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <DashPage
      back={{ href: routes.dash.lifeEvents.list, label: 'life event の一覧へ戻る' }}
      title="life event を作る"
    >
      <LifeEventForm action={registerLifeEvent} initialValues={toLifeEventFormValues()} />
    </DashPage>
  );
};

export default Page;
