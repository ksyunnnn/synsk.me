import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishedNote } from '@/features/note/components/published-note';
import { getPublishedNote } from '@/features/note/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// メタデータは公開している値だけから作る。下書き・削除した note・存在しない slug は、
// 本文と同じく 404
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const note = await getPublishedNote((await params).slug);
  if (!note) notFound();
  return { title: `${note.title} | synsk.me` };
};

const Page = async ({ params }: Props) => {
  const note = await getPublishedNote((await params).slug);
  if (!note) notFound();

  return (
    <main>
      <PublishedNote note={note} />
    </main>
  );
};

export default Page;
