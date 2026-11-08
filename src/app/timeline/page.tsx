import type { Metadata } from 'next';
import { Feed } from '@/features/activity/components/feed';
import { parseFeedPage } from '@/features/activity/domain/feed';
import { listFeed } from '@/features/activity/server/queries';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/005-feed/research.md の R12）
export const instant = false;

export const metadata: Metadata = {
  title: 'timeline | synsk.me',
  openGraph: { title: 'timeline' },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const Page = async ({ searchParams }: Props) => {
  const feed = await listFeed(parseFeedPage((await searchParams).page));
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-12">
      <h1 className="text-3xl font-bold">timeline</h1>
      <Feed feed={feed} />
    </main>
  );
};

export default Page;
