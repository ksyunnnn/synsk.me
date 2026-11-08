import type { Metadata } from 'next';
import { LifeEventForm } from '@/features/activity/components/life-event-form';
import { toLifeEventFormValues } from '@/features/activity/domain/life-event';
import { registerLifeEvent } from '@/features/activity/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event を作成する | synsk.me' };

const Page = async () => {
  await requireAuthor();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/life-events">life event の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">life event を作成する</h1>
      <p className="text-sm text-muted-foreground">
        期間のある出来事は、始まりと終わりの 2 件の life event で表します
      </p>
      <LifeEventForm action={registerLifeEvent} initialValues={toLifeEventFormValues()} />
    </main>
  );
};

export default Page;
