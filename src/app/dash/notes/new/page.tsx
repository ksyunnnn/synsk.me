import type { Metadata } from 'next';
import { NoteForm } from '@/features/note/components/note-form';
import { toNoteFormValues } from '@/features/note/domain/note';
import { createNote } from '@/features/note/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を作る | synsk.me' };

const Page = async () => {
  await requireAuthor();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/notes">note の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">note を作る</h1>
      <p>作った note は下書きです。公開するまで訪問者には見えません</p>
      <NoteForm action={createNote} initialValues={toNoteFormValues()} />
    </main>
  );
};

export default Page;
