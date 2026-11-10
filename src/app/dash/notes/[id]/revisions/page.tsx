import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteRevisionList } from '@/features/note/components/note-revision-list';
import { listNoteRevisions } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note の版 | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、note を読む前に 403 になる
  const found = await listNoteRevisions((await params).id);
  if (!found) notFound();
  const { note, revisions } = found;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={`/dash/notes/${note.uid}`}>編集の画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">版の一覧</h1>
      <p>{note.latestRevision.title || '（題なし）'}</p>
      <NoteRevisionList noteUid={note.uid} noteStatus={note.status} revisions={revisions} />
    </main>
  );
};

export default Page;
