import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  VisitorProjectView,
  visitorProjectImageUrl,
} from '@/features/project/components/visitor-project';
import { getVisitorProject } from '@/features/project/server/queries';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）。キャッシュしない
// （specs/001-career-and-project/research.md の R12）
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// メタデータは訪問者向けの DTO の値だけから作る。秘匿化した実績では秘匿化した題になる
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const project = await getVisitorProject((await params).slug);
  if (!project) notFound();
  // 代表画像は秘匿化しない実績の DTO だけが持つ（FR-030）
  const image =
    !project.isMasked && project.cardImageFile
      ? visitorProjectImageUrl(project.slug, project.cardImageFile)
      : undefined;
  return {
    title: `${project.title} | synsk.me`,
    openGraph: { title: project.title, images: image ? [image] : undefined },
  };
};

const Page = async ({ params }: Props) => {
  // 無い識別子は `src/proxy.ts` が描画の前に 404 の画面へ移す。読み出しの間に消えた
  // 実績はここで 404 にする
  const project = await getVisitorProject((await params).slug);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <VisitorProjectView project={project} />
    </main>
  );
};

export default Page;
