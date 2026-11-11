import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LinkPreviewRefetchForm } from '@/features/note/components/link-preview-refetch-form';
import { VisitorNoteView } from '@/features/note/components/visitor-note';
import { refetchLinkPreview } from '@/features/note/server/actions';
import { getNotePreview } from '@/features/note/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '訪問者に見せたときの見た目 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ refetched?: string | string[] }>;
};

/**
 * 公開したときの見た目（REQUIREMENTS.md の FR-13、specs/003-note/research.md の R15）。最も新しい版を
 * 訪問者向けと同じ部品で描き、状態と削除に関わらず出す。URL だけの段落ごとに、参照先の情報を
 * 取り直す操作を添える（spec の User Story 6 の 3）
 */
const Page = async ({ params, searchParams }: Props) => {
  const { id } = await params;
  const { refetched } = await searchParams;
  // オーナーでなければ、読む前に 403 になる
  const note = await getNotePreview(id);
  if (!note) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.notes.row(id)}>編集の画面へ戻る</TextLink>
      </p>
      <p role="note" className="rounded-md border border-input px-4 py-2 text-sm">
        最も新しい版を、訪問者に見せたときの見た目で出しています
      </p>
      {refetched === '1' && (
        <SavedNotice key={JSON.stringify(note.linkPreviews)} flags={['refetched']}>
          参照先の情報を取り直しました
        </SavedNotice>
      )}
      <VisitorNoteView
        note={note}
        mediaBase={routes.dash.notes.previewMedia(id)}
        renderUrlLineAction={(url) => (
          <LinkPreviewRefetchForm action={refetchLinkPreview} noteUid={id} url={url} />
        )}
      />
    </main>
  );
};

export default Page;
