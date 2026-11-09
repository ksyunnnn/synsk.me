import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LifeEventForm } from '@/features/activity/components/life-event-form';
import { LifeEventImageForm } from '@/features/activity/components/life-event-image-form';
import { toLifeEventFormValues } from '@/features/activity/domain/life-event';
import {
  editLifeEvent,
  registerLifeEventImage,
  removeLifeEventImage,
} from '@/features/activity/server/actions';
import { getLifeEventForEdit } from '@/features/activity/server/queries';
import { DraftSavedNotice } from '@/shared/components/draft-retention';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string | string[];
    imageSaved?: string | string[];
    imageRemoved?: string | string[];
  }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、life event を読む前に 403 になる
  const lifeEvent = await getLifeEventForEdit((await params).id);
  if (!lifeEvent) notFound();
  const { saved, imageSaved, imageRemoved } = await searchParams;
  const values = toLifeEventFormValues(lifeEvent);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/life-events">life event の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">life event を編集する</h1>
      {/* 続けて保存すると同じ `?saved=1` の画面へ移る。life event は更新日時を持たないので、保存した値が
          変わるたびに送った書きかけを消し直す */}
      {saved === '1' && (
        <DraftSavedNotice
          storageKeys={['life-event:new', `life-event:${lifeEvent.uid}`]}
          version={JSON.stringify(values)}
        />
      )}
      <p>
        <TextLink href={`/life-events/${lifeEvent.slug}`}>訪問者のページを開く</TextLink>
      </p>
      {/* 保存した値が変わったら、入力の初めの値を描き直す */}
      <LifeEventForm
        key={JSON.stringify(values)}
        action={editLifeEvent}
        initialValues={values}
        uid={lifeEvent.uid}
      />
      {imageSaved === '1' && <p role="status">代表画像を登録しました</p>}
      {imageRemoved === '1' && <p role="status">代表画像を外しました</p>}
      <LifeEventImageForm
        uid={lifeEvent.uid}
        cardImageUrl={lifeEvent.cardImageUrl}
        register={registerLifeEventImage}
        remove={removeLifeEventImage}
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
