import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteActionForm } from '@/features/note/components/note-action-form';
import { NOTE_UID_FIELD } from '@/features/note/domain/note';
import { deleteNote } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">note を削除する</h1>
      <p>
        次の note を削除します。訪問者のページは見つからなくなります。版と画像は残り、note
        の一覧の「削除した note」から戻せます。識別子は、戻すまでほかの note に使えません。
      </p>
      <p className="break-words">題: {note.latest.title || '（題なし）'}</p>
      <NoteActionForm
        action={deleteNote}
        hidden={{ [NOTE_UID_FIELD]: note.uid }}
        submitLabel="削除する"
        messages={{}}
        variant="destructive"
      />
      <p>
        <TextLink href={`/dash/notes/${note.uid}`}>編集の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
