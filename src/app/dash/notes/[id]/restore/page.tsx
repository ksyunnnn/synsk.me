import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RestoreNoteForm } from '@/features/note/components/restore-note-form';
import { restoreNoteAction } from '@/features/note/server/actions';
import { getDeletedNote } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'note を戻す | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、note を読む前に 403 になる
  const note = await getDeletedNote((await params).id);
  if (!note) notFound();

  return (
    <main>
      <h1>note を戻す</h1>
      <p>
        {note.status === 'published'
          ? '次の note を戻します。公開の状態に戻り、訪問者が再び読めるようになります。'
          : '次の note を戻します。下書きの状態に戻ります。'}
      </p>
      <p>slug: {note.slug}</p>
      <p>題: {note.title === '' ? '（題なし）' : note.title}</p>
      <RestoreNoteForm action={restoreNoteAction} noteId={note.id} />
      <p>
        <Link href="/dash">note の一覧へ戻る</Link>
      </p>
    </main>
  );
};

export default Page;
