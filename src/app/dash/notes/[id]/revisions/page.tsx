import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteRevisionList } from '@/features/note/components/note-revision-list';
import { isVisibleToVisitors } from '@/features/note/domain/note';
import { listNoteRevisions } from '@/features/note/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note の版 | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、note を読む前に 403 になる
  const found = await listNoteRevisions((await params).id);
  if (!found) notFound();
  const { note, revisions } = found;

  return (
    <DashPage
      back={{ href: routes.dash.notes.row(note.uid), label: '編集の画面へ戻る' }}
      title="版の一覧"
    >
      <p>{note.latestRevision.title || '（題なし）'}</p>
      <NoteRevisionList
        noteUid={note.uid}
        isNoteVisibleToVisitors={isVisibleToVisitors(note)}
        revisions={revisions}
      />
    </DashPage>
  );
};

export default Page;
