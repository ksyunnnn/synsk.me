import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteForm } from '@/features/note/components/note-form';
import { NoteRestoreForm } from '@/features/note/components/note-restore-form';
import { NoteSavedNotice } from '@/features/note/components/note-saved-notice';
import { NoteStatusForm } from '@/features/note/components/note-status-form';
import { NoteSyndicationForm } from '@/features/note/components/note-syndication-form';
import {
  NOTE_STATUS_LABELS,
  hasBeenPublished,
  toNoteFormValues,
} from '@/features/note/domain/note';
import {
  addNoteSyndication,
  publishNote,
  removeNoteSyndication,
  restoreNote,
  saveNote,
  unpublishNote,
} from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を編集する | synsk.me' };

type Flag = string | string[] | undefined;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Partial<Record<'saved' | keyof typeof NOTICES, Flag>>>;
};

/** 操作の後に移った画面で出す知らせ。保存の知らせは書きかけを消す `NoteSavedNotice` が出す */
const NOTICES = {
  published: '公開しました',
  unpublished: '下書きに戻しました',
  restored: '元に戻しました',
  reverted: '過去の版の中身を、新しい版として保存しました',
  syndicated: '転載先を記録しました',
  unsyndicated: '転載先を外しました',
} as const;

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();
  const flags = await searchParams;
  const notice = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find(
    (key) => flags[key] === '1',
  );

  if (note.deletedAt !== null) {
    // 削除した note は、中身を読み取りだけで出し、「元に戻す」だけを置く（contracts/dash.md）
    const { latestRevision } = note;
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
        <p>
          <TextLink href="/dash/notes">note の一覧へ戻る</TextLink>
        </p>
        <h1 className="text-2xl font-bold">削除した note</h1>
        <p>
          この note は削除済みです。訪問者には見えません。元に戻すと、削除の前の状態（
          {NOTE_STATUS_LABELS[note.status]}）と版に戻ります
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="font-bold">識別子</dt>
          <dd>{note.slug}</dd>
          <dt className="font-bold">題</dt>
          <dd>{latestRevision.title || '（題なし）'}</dd>
          <dt className="font-bold">説明文</dt>
          <dd>{latestRevision.description ?? ''}</dd>
          <dt className="font-bold">本文</dt>
          <dd className="whitespace-pre-wrap">{latestRevision.body}</dd>
        </dl>
        <NoteRestoreForm action={restoreNote} noteUid={note.uid} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/notes">note の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">note を編集する</h1>
      {flags.saved === '1' && <NoteSavedNotice revisionUid={note.latestRevision.uid} />}
      {notice && <p role="status">{NOTICES[notice]}</p>}
      {note.status === 'published' && (
        <p>
          <TextLink href={`/notes/${note.slug}`}>訪問者に見せるページを開く</TextLink>
        </p>
      )}
      <NoteStatusForm
        noteUid={note.uid}
        status={note.status}
        publishAction={publishNote}
        unpublishAction={unpublishNote}
      />
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
      <NoteSyndicationForm
        noteUid={note.uid}
        urls={note.syndicationUrls}
        addAction={addNoteSyndication}
        removeAction={removeNoteSyndication}
      />
      <ul className="flex flex-col gap-2">
        <li>
          <TextLink href={`/dash/notes/${note.uid}/revisions`}>版の一覧</TextLink>
        </li>
        <li>
          <TextLink href={`/dash/notes/${note.uid}/delete`}>この note を削除する</TextLink>
        </li>
      </ul>
    </main>
  );
};

export default Page;
