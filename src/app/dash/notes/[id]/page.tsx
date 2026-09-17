import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteForm } from '@/features/note/components/note-form';
import { toNoteFormState } from '@/features/note/domain/note';
import { editNoteAction } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'note を編集する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();

  return (
    <main>
      <p>
        <Link href="/dash">note の一覧へ戻る</Link>
      </p>
      <h1>note を編集する</h1>
      <p>状態: {note.status === 'published' ? '公開' : '下書き'}</p>
      <NoteForm
        action={editNoteAction}
        initialState={toNoteFormState(note)}
        note={{ id: note.id, status: note.status }}
      />
    </main>
  );
};

export default Page;
