import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VisitorResumeView } from '@/features/resume/components/visitor-resume';
import { getVisitorLimitedResume } from '@/features/resume/server/queries';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/002-resume/research.md の R7）
export const instant = false;

// 限定公開用のページの `<title>` と OGP に、職務経歴書の中身を出さない（ADR-0024）。
// 題を訪問者に出すかは specs/002-resume/plan.md の U10 で決まっていない
export const metadata: Metadata = {
  title: '職務経歴書 | synsk.me',
  openGraph: { title: '職務経歴書' },
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string; key: string }> };

const Page = async ({ params }: Props) => {
  // 中身を返さない要求は `src/proxy.ts` が描画の前に 404 の画面へ移す。読み出しの間に
  // 条件が変わった職務経歴書はここで 404 にする
  const { slug, key } = await params;
  const resume = await getVisitorLimitedResume(slug, key);
  if (!resume) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 print:max-w-none print:p-0">
      <VisitorResumeView resume={resume} />
    </main>
  );
};

export default Page;
