import Link from 'next/link';
import type { Metadata } from 'next';
import { NoteList } from '@/features/note/components/note-list';
import { listNotesForAuthor } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない。キャッシュのキーはホスト名を含まず、
// 作り手の画面が訪問者に返りうる（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'note の一覧 | synsk.me' };

const Page = async () => {
  // 作り手でなければ、ここで 403 になる
  const notes = await listNotesForAuthor();

  return (
    <main>
      <h1>note</h1>
      <p>
        <Link href="/dash/notes/new">新しい note を作る</Link>
      </p>
      <NoteList notes={notes} />
    </main>
  );
};

export default Page;
