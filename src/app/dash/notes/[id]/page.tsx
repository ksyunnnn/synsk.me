import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteForm } from '@/features/note/components/note-form';
import { NoteStatusForm } from '@/features/note/components/note-status-form';
import { hasBeenPublished, toNoteFormValues } from '@/features/note/domain/note';
import { publishNote, saveNote } from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';
import { DraftSavedNotice } from '@/shared/components/draft-retention';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[]; published?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();
  const { saved, published } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/notes">note の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">note を編集する</h1>
      {saved === '1' && <DraftSavedNotice />}
      {published === '1' && <p role="status">公開しました</p>}
      {note.status === 'published' && (
        <p>
          <TextLink href={`/notes/${note.slug}`}>訪問者に見せるページを開く</TextLink>
        </p>
      )}
      <NoteStatusForm noteUid={note.uid} status={note.status} publishAction={publishNote} />
      {/* 保存のたびに最も新しい版が変わる。入力の初めの値と比べる版を、保存した版で描き直す（FR-021） */}
      <NoteForm
        key={note.latestRevision.uid}
        action={saveNote}
        initialValues={toNoteFormValues(note)}
        note={{
          uid: note.uid,
          openedRevisionUid: note.latestRevision.uid,
          hasBeenPublished: hasBeenPublished(note),
        }}
      />
    </main>
  );
};

export default Page;
