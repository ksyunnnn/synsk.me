import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteView } from '@/features/note/components/note-view';
import { toCardDescription, type VisitorNote } from '@/features/note/domain/note';
import { getVisitorNote } from '@/features/note/server/queries';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/003-note/research.md の R12）
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

/** 代表画像の URL（specs/003-note/research.md の R8） */
const cardImageOf = (note: VisitorNote) => {
  switch (note.cardImage.source) {
    case 'media':
      return { url: `/notes/${note.slug}/images/${note.cardImage.file}`, large: true };
    case 'site':
      return { url: '/opengraph-image', large: false };
    case 'generated':
      return { url: `/notes/${note.slug}/card-image`, large: true };
  }
};

// メタデータは訪問者向けの DTO（公開した版）の値だけから作る
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const note = await getVisitorNote((await params).slug);
  if (!note) notFound();
  const description = toCardDescription(note) ?? undefined;
  const image = cardImageOf(note);
  return {
    title: `${note.title} | synsk.me`,
    description,
    openGraph: {
      type: 'article',
      title: note.title,
      description,
      siteName: 'synsk.me',
      publishedTime: note.publishedAt,
      images: [image.url],
    },
    twitter: {
      card: image.large ? 'summary_large_image' : 'summary',
      title: note.title,
      description,
      images: [image.url],
    },
  };
};

const Page = async ({ params }: Props) => {
  // 無い識別子・下書き・削除した note は `src/proxy.ts` が描画の前に 404 の画面へ移す。
  // 読み出しの間に変わった note はここで 404 にする
  const note = await getVisitorNote((await params).slug);
  if (!note) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <NoteView
        title={note.title}
        description={note.description}
        body={note.body}
        publishedAt={note.publishedAt}
        imageUrl={(file) => `/notes/${note.slug}/images/${file}`}
        linkPreviews={note.linkPreviews}
      />
    </main>
  );
};

export default Page;
