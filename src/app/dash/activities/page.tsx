import type { Metadata } from 'next';
import { OWNED_SOURCE_LABELS } from '@/features/activity/domain/external-activity';
import { listExternalActivities } from '@/features/activity/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity | synsk.me' };

type Props = {
  searchParams: Promise<{ saved?: string | string[]; deleted?: string | string[] }>;
};

/**
 * URL を指名した・手で入力した外部の activity の一覧（contracts/dash.md）。一覧を取る取得元の
 * activity は出さない（FR-022）
 */
const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const activities = await listExternalActivities();
  const { saved, deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.index}>管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">外部の activity</h1>
      <p>URL を指名して、または手で入力して登録した activity です。</p>
      {/* 登録に成功すると、この画面へ移る */}
      {saved === '1' && <SavedNotice flags={['saved']}>保存しました</SavedNotice>}
      {deleted === '1' && (
        <SavedNotice flags={['deleted']}>外部の activity を削除しました</SavedNotice>
      )}
      <p>
        <TextLink href={routes.dash.activities.new}>外部の activity を登録する</TextLink>
      </p>
      {activities.length === 0 ? (
        <p>登録した外部の activity はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activities.map((activity) => (
            <li key={activity.id} className="flex flex-col">
              <TextLink href={routes.dash.activities.row(activity.uid)}>{activity.title}</TextLink>
              <span className="text-sm text-muted-foreground">
                <time dateTime={activity.publishedOn}>{activity.publishedOn}</time>・
                {OWNED_SOURCE_LABELS[activity.source]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
