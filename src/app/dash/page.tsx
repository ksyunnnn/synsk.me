import Link from 'next/link';
import type { Metadata } from 'next';
import { DeletedNoteList } from '@/features/note/components/deleted-note-list';
import { NoteList } from '@/features/note/components/note-list';
import { getNoteDashboard } from '@/features/note/server/queries';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note の一覧 | synsk.me' };

/** 一覧の片方だけを読み出せなかったときの表示 */
const LOAD_FAILED_MESSAGE = 'この一覧を読み出せませんでした。時間をおいて、開き直してください。';

type Props = {
  searchParams: Promise<{ deleted?: string | string[]; restored?: string | string[] }>;
};

const Page = async ({ searchParams }: Props) => {
  // 作り手でなければ、ここで 403 になる。両方の一覧を読み出せなければ 500 になる
  const { notes, deletedNotes } = await getNoteDashboard();
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
      {notes ? <NoteList notes={notes} /> : <p role="alert">{LOAD_FAILED_MESSAGE}</p>}
      <h2>削除した note</h2>
      {deletedNotes ? (
        <DeletedNoteList notes={deletedNotes} />
      ) : (
        <p role="alert">{LOAD_FAILED_MESSAGE}</p>
      )}
    </main>
  );
};

export default Page;
