import Link from 'next/link';
import type { Metadata } from 'next';
import { NoteForm } from '@/features/note/components/note-form';
import { toNoteFormState } from '@/features/note/domain/note';
import { createNoteAction } from '@/features/note/server/actions';
import { requireAuthor } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '新しい note | synsk.me' };

const Page = async () => {
  // 作り手でなければ、ここで 403 になる
  await requireAuthor();

  return (
    <main>
      <p>
        <Link href="/dash">note の一覧へ戻る</Link>
      </p>
      <h1>新しい note</h1>
      <NoteForm action={createNoteAction} initialState={toNoteFormState()} submitLabel="作る" />
    </main>
  );
};

export default Page;
