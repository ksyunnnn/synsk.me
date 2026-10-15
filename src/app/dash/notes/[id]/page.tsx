import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteForm } from '@/features/note/components/note-form';
import { toNoteFormState } from '@/features/note/domain/note';
import { editNoteAction } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

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
        note={{ id: note.id, status: note.status, slugFixed: note.slugFixed }}
      />
      <p>
        <Link href={`/dash/notes/${note.id}/delete`}>この note を削除する</Link>
      </p>
    </main>
  );
};

export default Page;
