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
import { DashPage } from '@/shared/components/dash-page';
import { FormSection } from '@/shared/components/form-section';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

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
  const valuesVersion = JSON.stringify(values);

  return (
    <DashPage
      back={{ href: routes.dash.lifeEvents.list, label: 'life event の一覧へ戻る' }}
      title="life event を編集する"
    >
      {saved === '1' && (
        <SavedNotice key={valuesVersion} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      <p>
        <TextLink href={routes.lifeEvent(lifeEvent.slug)}>訪問者のページを開く</TextLink>
      </p>
      {/* 保存した値が変わったら、入力の初めの値を描き直す */}
      <FormSection title="内容" id="life-event-content">
        <LifeEventForm
          key={valuesVersion}
          action={editLifeEvent}
          initialValues={values}
          uid={lifeEvent.uid}
        />
      </FormSection>
      <FormSection>
        {imageSaved === '1' && (
          <SavedNotice key={lifeEvent.cardImageUrl ?? ''} flags={['imageSaved']}>
            代表画像を登録しました
          </SavedNotice>
        )}
        {imageRemoved === '1' && (
          <SavedNotice key={lifeEvent.cardImageUrl ?? ''} flags={['imageRemoved']}>
            代表画像を外しました
          </SavedNotice>
        )}
        <LifeEventImageForm
          uid={lifeEvent.uid}
          cardImageUrl={lifeEvent.cardImageUrl}
          register={registerLifeEventImage}
          remove={removeLifeEventImage}
        />
      </FormSection>
      <FormSection>
        <p>
          <TextLink href={routes.dash.lifeEvents.delete(lifeEvent.uid)}>
            この life event を削除する
          </TextLink>
        </p>
      </FormSection>
    </DashPage>
  );
};

export default Page;
