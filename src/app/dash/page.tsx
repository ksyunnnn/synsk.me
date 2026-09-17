import Link from 'next/link';
import type { Metadata } from 'next';
import { NoteList } from '@/features/note/components/note-list';
import { listNotesForAuthor } from '@/features/note/server/queries';

// 作り手の画面をエッジのキャッシュに載せない。キャッシュのキーはホスト名を含まず、
// 作り手の画面が訪問者に返りうる（specs/005-note-write-and-read/research.md の R3）
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'note の一覧 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // 作り手でなければ、ここで 403 になる
  const notes = await listNotesForAuthor();
  // 削除の操作が、削除できたときに `?deleted=1` を付けてこの画面へ移す
  const deleted = (await searchParams).deleted === '1';

  return (
    <main>
      <h1>note</h1>
      {deleted && <p role="status">note を削除しました</p>}
      <p>
        <Link href="/dash/notes/new">新しい note を作る</Link>
      </p>
      <NoteList notes={notes} />
    </main>
  );
};

export default Page;
