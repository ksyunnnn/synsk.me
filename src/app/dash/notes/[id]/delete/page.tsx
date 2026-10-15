import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteNoteForm } from '@/features/note/components/delete-note-form';
import { deleteNoteAction } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();

  return (
    <main>
      <h1>note を削除する</h1>
      <p>
        次の note を削除します。訪問者には見えなくなります。削除した note は、note
        の一覧の画面から戻せます。
      </p>
      <p>slug: {note.slug}</p>
      <p>題: {note.title === '' ? '（題なし）' : note.title}</p>
      <DeleteNoteForm action={deleteNoteAction} noteId={note.id} />
      <p>
        <Link href={`/dash/notes/${note.id}`}>編集の画面へ戻る</Link>
      </p>
    </main>
  );
};

export default Page;
