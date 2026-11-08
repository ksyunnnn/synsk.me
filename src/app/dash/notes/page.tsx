import type { Metadata } from 'next';
import { NOTE_STATUS_LABELS, type NoteSummary } from '@/features/note/domain/note';
import { listNotes } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note | synsk.me' };

type Props = { searchParams: Promise<{ done?: string | string[] }> };

const NoteItem = ({ note }: { note: NoteSummary }) => (
  <li className="flex flex-col">
    <TextLink href={`/dash/notes/${note.uid}`}>{note.title || '（題なし）'}</TextLink>
    <span className="text-sm text-muted-foreground">
      {note.slug}・{NOTE_STATUS_LABELS[note.status]}・版 {note.latestRevisionNumber}
      {note.publishedRevisionNumber !== null &&
        note.publishedRevisionNumber !== note.latestRevisionNumber &&
        `（公開している版は ${note.publishedRevisionNumber}）`}
    </span>
  </li>
);

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const notes = await listNotes();
  const { done } = await searchParams;
  const live = notes.filter((note) => !note.isDeleted);
  const deleted = notes.filter((note) => note.isDeleted);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">note</h1>
      {done === 'deleted' && (
        <p role="status">note を削除しました。下の「削除した note」から戻せます</p>
      )}
      <p>
        <TextLink href="/dash/notes/new">note を作る</TextLink>
      </p>
      {live.length === 0 ? (
        <p>作った note はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {live.map((note) => (
            <NoteItem key={note.uid} note={note} />
          ))}
        </ul>
      )}
      {deleted.length > 0 && (
        <section aria-labelledby="deleted-notes" className="flex flex-col gap-3">
          <h2 id="deleted-notes" className="text-xl font-bold">
            削除した note
          </h2>
          <ul className="flex flex-col gap-3">
            {deleted.map((note) => (
              <NoteItem key={note.uid} note={note} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};

export default Page;
