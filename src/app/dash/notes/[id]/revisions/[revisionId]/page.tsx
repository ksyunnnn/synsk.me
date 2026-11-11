import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteRevertForm } from '@/features/note/components/note-revert-form';
import { formatSavedAt } from '@/features/note/components/note-revision-list';
import { isVisibleToVisitors } from '@/features/note/domain/note';
import { revertNote } from '@/features/note/server/actions';
import { getNoteRevision } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note の過去の版 | synsk.me' };

type Props = { params: Promise<{ id: string; revisionId: string }> };

const Page = async ({ params }: Props) => {
  const { id, revisionId } = await params;
  // オーナーでなければ、note を読む前に 403 になる
  const found = await getNoteRevision(id, revisionId);
  if (!found) notFound();
  const { note, revision } = found;
  const isLatest = revision.uid === note.latestRevision.uid;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.notes.revisions(note.uid)}>版の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">過去の版</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-bold">保存した日時</dt>
        <dd>
          <time dateTime={revision.createdAt}>{formatSavedAt(revision.createdAt)}</time>
        </dd>
        <dt className="font-bold">題</dt>
        <dd>{revision.title || '（題なし）'}</dd>
        <dt className="font-bold">説明文</dt>
        <dd>{revision.description ?? ''}</dd>
        <dt className="font-bold">本文</dt>
        <dd className="whitespace-pre-wrap">{revision.body}</dd>
      </dl>
      {isLatest ? (
        <p>この版は最も新しい版です</p>
      ) : (
        note.deletedAt === null && (
          <>
            {/* 訪問者に見えない note では訪問者についての説明を出さない。版の一覧の公開した版の印と
                同じ `isVisibleToVisitors` で決める（note-revision-list.tsx） */}
            <p>
              戻すと、この版の題・説明文・本文が新しい版として保存されます。
              {isVisibleToVisitors(note) && '訪問者には、公開し直すまで今の公開した版を見せます'}
            </p>
            <NoteRevertForm
              action={revertNote}
              noteUid={note.uid}
              revisionUid={revision.uid}
              openedRevisionUid={note.latestRevision.uid}
            />
          </>
        )
      )}
    </main>
  );
};

export default Page;
