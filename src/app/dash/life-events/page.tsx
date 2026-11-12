import type { Metadata } from 'next';
import { listLifeEvents } from '@/features/activity/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'life event | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const lifeEvents = await listLifeEvents();
  const { deleted } = await searchParams;

  return (
    <DashPage back={{ href: routes.dash.index, label: '管理画面へ戻る' }} title="life event">
      {deleted === '1' && <SavedNotice flags={['deleted']}>life event を削除しました</SavedNotice>}
      <p>
        <TextLink href={routes.dash.lifeEvents.new}>life event を作る</TextLink>
      </p>
      {lifeEvents.length === 0 ? (
        <p>作った life event はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lifeEvents.map((lifeEvent) => (
            <li key={lifeEvent.id} className="flex flex-col">
              <TextLink href={routes.dash.lifeEvents.row(lifeEvent.uid)}>
                {lifeEvent.title}
              </TextLink>
              <span className="text-sm text-muted-foreground">
                <time dateTime={lifeEvent.happenedOn}>{lifeEvent.happenedOn}</time>・ /life-events/
                {lifeEvent.slug}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashPage>
  );
};

export default Page;
