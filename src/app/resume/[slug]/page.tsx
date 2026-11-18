import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VisitorResumeView } from '@/features/resume/components/visitor-resume';
import { ToolbarBackLink } from '@/features/resume/components/toolbar-link';
import { getVisitorLimitedResume } from '@/features/resume/server/queries';
import { routes } from '@/shared/routes';

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

// 職務経歴書は PDF と同じく、どの画面でも A4 の横幅（794px）の組みのまま全体を縮めて見せる。
// このページだけに効かせる（https://nextjs.org/docs/app/api-reference/functions/generate-viewport）。
// 既定の initial-scale=1 が残ると狭い画面で縮まないため、undefined で外す（vinext の
// mergeViewport は undefined の値を meta に書かない）
export const viewport: Viewport = { width: 794, initialScale: undefined };

type Props = { params: Promise<{ slug: string }> };

/**
 * 限定公開用の職務経歴書（specs/002-resume/contracts/visitor-resume.md）。識別子は限定公開用と
 * 公開用で重ならない（`resume.slug` の UNIQUE）ため、公開用も同じ経路で読む形にできる。
 * 公開用は tasks.md の Phase 7（US5）で足すまで読まず、404 になる
 */
const Page = async ({ params }: Props) => {
  // 中身を返さない要求は `src/proxy.ts` が描画の前に 404 の画面へ移す。読み出しの間に
  // 条件が変わった職務経歴書はここで 404 にする
  const { slug } = await params;
  const resume = await getVisitorLimitedResume(slug);
  if (!resume) notFound();

  return (
    <main>
      <VisitorResumeView
        resume={resume}
        toolbarStart={<ToolbarBackLink href={routes.top}>トップへ戻る</ToolbarBackLink>}
        mediaSrc={(key) => routes.resumeMedia(slug, key)}
        footerEnd={
          // Figma の Quiet / Button / Secondary（node 2:167）。紙では押せないので印刷に出さない
          <Link
            href={routes.top}
            className="shrink-0 border border-[#686868] px-[19.9px] py-[8.7px] text-[12.4px] leading-[22.3px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:hidden"
          >
            トップへ戻る
          </Link>
        }
      />
    </main>
  );
};

export default Page;
