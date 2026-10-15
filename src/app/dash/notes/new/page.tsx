import Link from 'next/link';
import type { Metadata } from 'next';
import { NoteForm } from '@/features/note/components/note-form';
import { toNoteFormState } from '@/features/note/domain/note';
import { createNoteAction } from '@/features/note/server/actions';
import { requireAuthor } from '@/features/note/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

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
      <NoteForm action={createNoteAction} initialState={toNoteFormState()} />
    </main>
  );
};

export default Page;
