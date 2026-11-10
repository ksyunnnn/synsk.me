import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VisitorNoteView } from '@/features/note/components/visitor-note';
import { NOTE_SHARE_IMAGE_SIZE, noteShareImagePath } from '@/features/note/domain/share-image';
import { getVisitorNote } from '@/features/note/server/queries';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/003-note/research.md の R9）
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// メタデータは訪問者向けの DTO の題と説明だけから作る（contracts/visitor-note.md の OGP）。
// 説明は、説明文が空なら本文の最初の段落。共有したときは、小さい正方形の画像の隣に文字が並ぶ
// カードにする（plan.md の U8）。`twitter:card` を `summary` にし、画像は代表画像を小さい正方形に
// したもの。サイト全体の設定（`src/app/layout.tsx` の `summary_large_image`）は変えない
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const note = await getVisitorNote((await params).slug);
  if (!note) notFound();
  const description = note.summary ?? undefined;
  const image = {
    url: noteShareImagePath(note.slug, note.cardImage),
    width: NOTE_SHARE_IMAGE_SIZE,
    height: NOTE_SHARE_IMAGE_SIZE,
    alt: note.title,
  };
  return {
    title: `${note.title} | synsk.me`,
    description,
    openGraph: {
      title: note.title,
      description,
      type: 'article',
      images: [image],
    },
    twitter: {
      card: 'summary',
      title: note.title,
      description,
      images: [image],
    },
  };
};

const Page = async ({ params }: Props) => {
  // 訪問者に見せない識別子は `src/proxy.ts` が描画の前に 404 の画面へ移す。読み出しの間に
  // 下書きに戻した・削除した note はここで 404 にする
  const note = await getVisitorNote((await params).slug);
  if (!note) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <VisitorNoteView note={note} />
    </main>
  );
};

export default Page;
