import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  EXTERNAL_ACTIVITY_UID_FIELD,
  OWNED_SOURCE_LABELS,
} from '@/features/activity/domain/external-activity';
import { deleteExternalActivity } from '@/features/activity/server/actions';
import { getExternalActivityForEdit } from '@/features/activity/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、activity を読む前に 403 になる
  const activity = await getExternalActivityForEdit((await params).id);
  if (!activity) notFound();

  return (
    <DashPage title="外部の activity を削除する">
      <p>次の activity を削除します。戻せません。一覧にも出なくなります。</p>
      <p>
        {activity.title}・{OWNED_SOURCE_LABELS[activity.source]}・
        <time dateTime={activity.publishedOn}>{activity.publishedOn}</time>
      </p>
      <DeleteForm
        action={deleteExternalActivity}
        uidField={EXTERNAL_ACTIVITY_UID_FIELD}
        uid={activity.uid}
        messages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={routes.dash.activities.row(activity.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
