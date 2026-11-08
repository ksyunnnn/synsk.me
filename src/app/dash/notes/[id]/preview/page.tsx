import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteView } from '@/features/note/components/note-view';
import { getLinkPreviewsForPreview, getNoteForEdit } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note のプレビュー | synsk.me' };

type Props = { params: Promise<{ id: string }> };

/**
 * 公開したときの見た目を、公開する前に確かめる（REQUIREMENTS.md の FR-13）。最新の版を、
 * 訪問者のページと同じ部品で描く。画像はオーナーの経路から出す
 */
const Page = async ({ params }: Props) => {
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();
  const linkPreviews = await getLinkPreviewsForPreview(note.latest.body);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <p>版 {note.latest.number} のプレビューです。公開すると、訪問者にこの見た目で出ます。</p>
        <p>
          <TextLink href={`/dash/notes/${note.uid}`}>編集の画面へ戻る</TextLink>
        </p>
      </div>
      <NoteView
        title={note.latest.title || '（題なし）'}
        description={note.latest.description}
        body={note.latest.body}
        publishedAt={note.publishedAt}
        imageUrl={(file) => `/dash/notes/${note.uid}/images/${file}`}
        linkPreviews={linkPreviews}
      />
    </main>
  );
};

export default Page;
