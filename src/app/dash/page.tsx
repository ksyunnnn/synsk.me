import Link from 'next/link';
import type { Metadata } from 'next';
import { DeletedNoteList } from '@/features/note/components/deleted-note-list';
import { NoteList } from '@/features/note/components/note-list';
import { listDeletedNotesForAuthor, listNotesForAuthor } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない。キャッシュのキーはホスト名を含まず、
// 作り手の画面が訪問者に返りうる（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'note の一覧 | synsk.me' };

type Props = {
  searchParams: Promise<{ deleted?: string | string[]; restored?: string | string[] }>;
};

const Page = async ({ searchParams }: Props) => {
  // 作り手でなければ、ここで 403 になる
  const notes = await listNotesForAuthor();
  const deletedNotes = await listDeletedNotesForAuthor();
  // 削除と戻す操作が、できたときに `?deleted=1`・`?restored=1` を付けてこの画面へ移す
  const { deleted, restored } = await searchParams;

  return (
    <main>
      <h1>note</h1>
      {deleted === '1' && <p role="status">note を削除しました</p>}
      {restored === '1' && <p role="status">note を戻しました</p>}
      <p>
        <Link href="/dash/notes/new">新しい note を作る</Link>
      </p>
      <NoteList notes={notes} />
      <h2>削除した note</h2>
      <DeletedNoteList notes={deletedNotes} />
    </main>
  );
};

export default Page;
