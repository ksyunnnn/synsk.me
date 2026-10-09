import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishedNote } from '@/features/note/components/published-note';
import { getPublishedNote } from '@/features/note/server/queries';
import { createMetadata } from '@/lib/createMetadata';

// エッジのキャッシュに載せず、要求のたびに D1 から描画する。公開と削除を、
// キャッシュの削除に頼らずに次の要求から反映するため
// （specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

// メタデータは公開している値だけから作る。下書きと存在しない slug は、本文と同じく 404
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const note = await getPublishedNote((await params).slug);
  if (!note) notFound();
  return createMetadata({ title: note.title });
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
