import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VisitorResumeView } from '@/features/resume/components/visitor-resume';
import { getResumePreview } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '訪問者に見せたときの見た目 | synsk.me' };

type Props = { params: Promise<{ id: string }> };

/**
 * 訪問者に見せたときの見た目（REQUIREMENTS.md の FR-13）。訪問者向けと同じ DTO と部品で描き、
 * 状態・期限に関わらず出す
 */
const Page = async ({ params }: Props) => {
  const { id } = await params;
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumePreview(id);
  if (!resume) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 flex flex-col gap-8 print:max-w-none print:p-0">
      <p className="print:hidden">
        <TextLink href={routes.dash.resumes.row(id)}>設定の画面へ戻る</TextLink>
      </p>
      <VisitorResumeView resume={resume} />
    </main>
  );
};

export default Page;
