import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VisitorNoteView } from '@/features/note/components/visitor-note';
import type { VisitorNote } from '@/features/note/domain/note';
import { getVisitorNote } from '@/features/note/server/queries';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/003-note/research.md の R9）
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// メタデータは訪問者向けの DTO の題と説明だけから作る（contracts/visitor-note.md の OGP）。
// 説明は、説明文が空なら本文の最初の段落
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const note = await getVisitorNote((await params).slug);
  if (!note) notFound();
  const description = note.summary ?? undefined;
  const images = cardImageUrl(note);
  return {
    title: `${note.title} | synsk.me`,
    description,
    openGraph: {
      title: note.title,
      description,
      type: 'article',
      ...(images ? { images } : {}),
    },
  };
};

/**
 * 代表画像の URL（research.md の R12）。`site` はサイト共通の画像（`src/app/opengraph-image.tsx`）、
 * `media` はその note の画像の配る経路。題を入れて自動で作る画像は作り方が決まるまで出さない
 * （plan.md の U8）
 */
const cardImageUrl = ({ slug, cardImage }: VisitorNote): string | null => {
  if (cardImage.kind === 'site') return '/opengraph-image';
  if (cardImage.kind === 'media')
    return `/notes/${encodeURIComponent(slug)}/media/${cardImage.storageKey}`;
  return null;
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
