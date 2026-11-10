import type { Metadata, ResolvingMetadata } from 'next';
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
// 説明は、説明文が空なら本文の最初の段落。共有したときは、小さい画像の隣に文字が並ぶカードにする
// ため、`twitter:card` を `summary` にする（plan.md の U8）。サイト全体の設定（`src/app/layout.tsx`
// の `summary_large_image`）は変えない。`twitter` を書くと root layout の `twitter` を置き換えるため、
// `twitter:creator` は親のメタデータから引き継ぐ
// （https://nextjs.org/docs/app/api-reference/functions/generate-metadata の `parent`）
export const generateMetadata = async (
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> => {
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
      images,
    },
    twitter: {
      card: 'summary',
      creator: (await parent).twitter?.creator ?? undefined,
      title: note.title,
      description,
      images,
    },
  };
};

/**
 * 代表画像の URL（research.md の R12）。`media` はその note の画像の配る経路で、縮めずに原本を
 * 出す。`site` の note 用のサイト共通の画像はオーナーが用意するまで出さず、画像の無いカードにする
 * （plan.md の U8）。空の並びを渡し、サイト共通の 1200×630 の画像（`src/app/opengraph-image.tsx`）
 * を引き継がない
 */
const cardImageUrl = ({ slug, cardImage }: VisitorNote): string[] =>
  cardImage.kind === 'media'
    ? [`/notes/${encodeURIComponent(slug)}/media/${cardImage.storageKey}`]
    : [];

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
