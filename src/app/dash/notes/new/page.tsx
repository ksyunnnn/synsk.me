import type { Metadata } from 'next';
import { NoteForm } from '@/features/note/components/note-form';
import { toNoteFormValues } from '@/features/note/domain/note';
import { createNote } from '@/features/note/server/actions';
import { DashPage } from '@/shared/components/dash-page';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を作る | synsk.me' };

const Page = async () => {
  await requireAuthor();

  return (
    <DashPage
      back={{ href: routes.dash.notes.list, label: 'note の一覧へ戻る' }}
      title="note を作る"
    >
      <p>作った note は下書きです。公開するまで訪問者には見えません</p>
      <NoteForm action={createNote} initialValues={toNoteFormValues()} />
    </DashPage>
  );
};

export default Page;
