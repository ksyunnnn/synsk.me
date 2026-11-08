import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listNoteRevisions } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note の版 | synsk.me' };

type Props = { params: Promise<{ id: string }> };

/** 版の一覧（specs/003-note/spec.md の FR-008）。新しい版から並べる */
const Page = async ({ params }: Props) => {
  const result = await listNoteRevisions((await params).id);
  if (!result) notFound();
  const { note, revisions } = result;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={`/dash/notes/${note.uid}`}>編集の画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">版の一覧</h1>
      <ul className="flex flex-col gap-3">
        {revisions.map((revision) => (
          <li key={revision.number} className="flex flex-col">
            <TextLink href={`/dash/notes/${note.uid}/revisions/${revision.number}`}>
              版 {revision.number}: {revision.title || '（題なし）'}
            </TextLink>
            <span className="text-sm text-muted-foreground">
              <time dateTime={revision.createdAt}>{revision.createdAt}</time>
              {revision.number === note.latest.number && '・最新の版'}
              {note.status === 'published' &&
                revision.number === note.publishedRevisionNumber &&
                '・公開している版'}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default Page;
