import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LifeEventForm } from '@/features/activity/components/life-event-form';
import { toLifeEventFormValues } from '@/features/activity/domain/life-event';
import { editLifeEvent } from '@/features/activity/server/actions';
import { getLifeEventForEdit } from '@/features/activity/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const lifeEvent = await getLifeEventForEdit((await params).id);
  if (!lifeEvent) notFound();
  const { saved } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/life-events">life event の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">life event を編集する</h1>
      {saved === '1' && <p role="status">保存しました</p>}
      <p>
        <TextLink href={`/life-events/${lifeEvent.slug}`}>訪問者に見せるページを開く</TextLink>
      </p>
      {/* 保存のたびに値が変わる。入力の初めの値を、保存した値で描き直す */}
      <LifeEventForm
        key={`${lifeEvent.slug}|${lifeEvent.title}|${lifeEvent.happenedOn}|${lifeEvent.description ?? ''}`}
        action={editLifeEvent}
        initialValues={toLifeEventFormValues(lifeEvent)}
        lifeEvent={{ uid: lifeEvent.uid }}
      />
      <p>
        <TextLink href={`/dash/life-events/${lifeEvent.uid}/delete`}>
          この life event を削除する
        </TextLink>
      </p>
    </main>
  );
};

export default Page;
