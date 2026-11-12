import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExternalActivityForm } from '@/features/activity/components/external-activity-form';
import {
  isManualSource,
  toExternalActivityFormValues,
} from '@/features/activity/domain/external-activity';
import { editExternalActivity } from '@/features/activity/server/actions';
import { getExternalActivityForEdit } from '@/features/activity/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、activity を読む前に 403 になる
  const activity = await getExternalActivityForEdit((await params).id);
  if (!activity) notFound();
  const { saved } = await searchParams;
  const values = toExternalActivityFormValues(activity);
  const valuesVersion = JSON.stringify(values);

  return (
    <DashPage
      back={{ href: routes.dash.activities.list, label: '外部の activity の一覧へ戻る' }}
      title="外部の activity を編集する"
    >
      {saved === '1' && (
        <SavedNotice key={valuesVersion} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      <p>
        <TextLink href={activity.url}>取得元のページを開く</TextLink>
      </p>
      {/* 保存した値が変わったら、入力の初めの値を描き直す */}
      <ExternalActivityForm
        key={valuesVersion}
        action={editExternalActivity}
        initialValues={values}
        editing={{
          uid: activity.uid,
          source: activity.source,
          isManual: isManualSource(activity.source),
        }}
      />
      <p>
        <TextLink href={routes.dash.activities.delete(activity.uid)}>
          この activity を削除する
        </TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
