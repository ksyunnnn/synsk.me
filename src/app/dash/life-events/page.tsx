import type { Metadata } from 'next';
import { listLifeEvents } from '@/features/activity/server/queries';
import { TextLink } from '@/shared/components/text-link';

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
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">life event</h1>
      {deleted === '1' && <p role="status">life event を削除しました</p>}
      <p>
        <TextLink href="/dash/life-events/new">life event を作る</TextLink>
      </p>
      {lifeEvents.length === 0 ? (
        <p>作った life event はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lifeEvents.map((lifeEvent) => (
            <li key={lifeEvent.id} className="flex flex-col">
              <TextLink href={`/dash/life-events/${lifeEvent.uid}`}>
                {lifeEvent.title ?? '（題なし）'}
              </TextLink>
              <span className="text-sm text-muted-foreground">
                <time dateTime={lifeEvent.happenedOn}>{lifeEvent.happenedOn}</time>・ /life-events/
                {lifeEvent.slug}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
