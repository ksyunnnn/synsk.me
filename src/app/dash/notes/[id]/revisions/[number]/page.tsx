import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteActionForm } from '@/features/note/components/note-action-form';
import { NoteView } from '@/features/note/components/note-view';
import {
  NOTE_UID_FIELD,
  OPENED_REVISION_FIELD,
  RESTORE_REVISION_FIELD,
} from '@/features/note/domain/note';
import { restoreRevision } from '@/features/note/server/actions';
import { getLinkPreviewsForPreview, getNoteRevision } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note の版 | synsk.me' };

type Props = { params: Promise<{ id: string; number: string }> };

/** 過去の版を、保存したときの題・説明文・本文のまま見せ、その版に戻す（FR-008・FR-009） */
const Page = async ({ params }: Props) => {
  const { id, number } = await params;
  const result = await getNoteRevision(id, number);
  if (!result) notFound();
  const { note, revision } = result;
  const linkPreviews = await getLinkPreviewsForPreview(revision.body);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-md border border-border p-4">
        <p>
          版 {revision.number}（<time dateTime={revision.createdAt}>{revision.createdAt}</time>
          に保存）です。最新の版は版 {note.latest.number} です。
        </p>
        <p>
          <TextLink href={`/dash/notes/${note.uid}/revisions`}>版の一覧へ戻る</TextLink>
        </p>
        {!note.isDeleted && revision.number !== note.latest.number && (
          <NoteActionForm
            action={restoreRevision}
            hidden={{
              [NOTE_UID_FIELD]: note.uid,
              [RESTORE_REVISION_FIELD]: revision.number,
              [OPENED_REVISION_FIELD]: note.latest.number,
            }}
            submitLabel="この版に戻す"
            messages={{}}
          />
        )}
      </div>
      <NoteView
        title={revision.title || '（題なし）'}
        description={revision.description}
        body={revision.body}
        publishedAt={null}
        imageUrl={(file) => `/dash/notes/${note.uid}/images/${file}`}
        linkPreviews={linkPreviews}
      />
      <details>
        <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          本文の Markdown
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm">
          {revision.body}
        </pre>
      </details>
    </main>
  );
};

export default Page;
