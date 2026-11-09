import type { Metadata } from 'next';
import { LifeEventForm } from '@/features/activity/components/life-event-form';
import { toLifeEventFormValues } from '@/features/activity/domain/life-event';
import { registerLifeEvent } from '@/features/activity/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event を作る | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/life-events">life event の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">life event を作る</h1>
      <LifeEventForm action={registerLifeEvent} initialValues={toLifeEventFormValues()} />
    </main>
  );
};

export default Page;
