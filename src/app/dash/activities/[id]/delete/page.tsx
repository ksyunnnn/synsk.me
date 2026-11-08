import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ACTIVITY_UID_FIELD, canDelete } from '@/features/activity/domain/activity';
import { deleteActivity } from '@/features/activity/server/actions';
import { getActivityForEdit } from '@/features/activity/server/queries';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const activity = await getActivityForEdit((await params).id);
  if (!activity) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">外部の activity を削除する</h1>
      {canDelete(activity.source) ? (
        <>
          <p>次の activity を削除します。一覧から消え、戻せません。</p>
          <p>題: {activity.title}</p>
          <DeleteForm
            action={deleteActivity}
            uidField={ACTIVITY_UID_FIELD}
            uid={activity.uid}
            messages={{
              forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
              'not-deletable': '一覧を取る取得元の activity は削除できません',
            }}
          />
        </>
      ) : (
        <p>
          一覧を取る取得元の activity は削除できません。出したくないときは、取得元で非公開にします
        </p>
      )}
      <p>
        <TextLink href={`/dash/activities/${activity.uid}`}>activity の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
