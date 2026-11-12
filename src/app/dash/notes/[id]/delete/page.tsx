import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NOTE_UID_FIELD } from '@/features/note/domain/note';
import { deleteNote } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

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
    <DashPage title="note を削除する">
      <p>
        次の note
        を削除します。訪問者のページは見つからなくなります。データは残り、編集の画面から元に戻せます。
      </p>
      <p>題: {note.latestRevision.title || '（題なし）'}</p>
      <DeleteForm
        action={deleteNote}
        uidField={NOTE_UID_FIELD}
        uid={note.uid}
        messages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={routes.dash.notes.row(note.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
