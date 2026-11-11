import type { Metadata } from 'next';
import { NOTE_STATUS_LABELS } from '@/features/note/domain/note';
import { listNotes } from '@/features/note/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const notes = await listNotes();
  const { deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.index}>管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">note</h1>
      {deleted === '1' && <SavedNotice flags={['deleted']}>note を削除しました</SavedNotice>}
      <p>
        <TextLink href={routes.dash.notes.new}>note を作る</TextLink>
      </p>
      {notes.length === 0 ? (
        <p>作った note はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.uid} className="flex flex-col">
              <TextLink href={routes.dash.notes.row(note.uid)}>
                {note.title || '（題なし）'}
              </TextLink>
              <span className="text-sm text-muted-foreground">
                {note.slug}・{NOTE_STATUS_LABELS[note.status]}
                {note.isDeleted && '・削除済み'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
