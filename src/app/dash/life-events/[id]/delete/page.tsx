import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LIFE_EVENT_UID_FIELD } from '@/features/activity/domain/life-event';
import { deleteLifeEvent } from '@/features/activity/server/actions';
import { getLifeEventForEdit } from '@/features/activity/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、life event を読む前に 403 になる
  const lifeEvent = await getLifeEventForEdit((await params).id);
  if (!lifeEvent) notFound();

  return (
    <DashPage title="life event を削除する">
      <p>次の life event を削除します。戻せません。訪問者のページも無くなります。</p>
      <p>
        {lifeEvent.title}・<time dateTime={lifeEvent.happenedOn}>{lifeEvent.happenedOn}</time>
      </p>
      <DeleteForm
        action={deleteLifeEvent}
        uidField={LIFE_EVENT_UID_FIELD}
        uid={lifeEvent.uid}
        messages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={routes.dash.lifeEvents.row(lifeEvent.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
