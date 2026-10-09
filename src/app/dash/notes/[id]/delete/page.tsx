import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteNoteForm } from '@/features/note/components/delete-note-form';
import { deleteNoteAction } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'note を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();

  return (
    <main>
      <h1>note を削除する</h1>
      <p>次の note を削除します。公開している内容も消え、元に戻せません。</p>
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
