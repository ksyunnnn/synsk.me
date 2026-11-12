import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VisitorLifeEventView } from '@/features/activity/components/visitor-life-event';
import { getVisitorLifeEvent } from '@/features/activity/server/queries';
import { BackToTopLink } from '@/shared/components/back-to-top-link';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/004-external-activity/research.md の R14）
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// メタデータは訪問者向けの DTO の値だけから作る。開発中のページは検索エンジンに載せない
// （https://developers.google.com/search/docs/crawling-indexing/block-indexing）
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const lifeEvent = await getVisitorLifeEvent((await params).slug);
  if (!lifeEvent) notFound();
  return {
    title: `${lifeEvent.title} | synsk.me`,
    openGraph: { title: lifeEvent.title },
    robots: { index: false },
  };
};

const Page = async ({ params }: Props) => {
  // 無い識別子は `src/proxy.ts` が描画の前に 404 の画面へ移す。読み出しの間に消えた
  // life event はここで 404 にする
  const lifeEvent = await getVisitorLifeEvent((await params).slug);
  if (!lifeEvent) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <BackToTopLink />
      <VisitorLifeEventView lifeEvent={lifeEvent} />
    </main>
  );
};

export default Page;
