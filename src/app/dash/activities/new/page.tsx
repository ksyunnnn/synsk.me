import type { Metadata } from 'next';
import { ExternalActivityForm } from '@/features/activity/components/external-activity-form';
import { toExternalActivityFormValues } from '@/features/activity/domain/external-activity';
import { registerExternalActivity } from '@/features/activity/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.activities.list}>外部の activity の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">外部の activity を登録する</h1>
      <ExternalActivityForm
        action={registerExternalActivity}
        initialValues={toExternalActivityFormValues()}
      />
    </main>
  );
};

export default Page;
