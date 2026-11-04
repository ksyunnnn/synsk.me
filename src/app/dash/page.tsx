import Link from 'next/link';
import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { getCurrentAuthor } from '@/shared/server/author';

// 要求時のデータ（作り手の確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '管理画面 | synsk.me' };

/** 各一覧への入口。経路は specs/001-career-and-project/contracts/dash.md */
const SECTIONS = [
  { href: '/dash/careers', label: '職歴' },
  { href: '/dash/projects', label: '実績' },
  { href: '/dash/educations', label: '学歴' },
  { href: '/dash/skills', label: 'スキル' },
  { href: '/dash/organizations', label: '組織' },
] as const;

const Page = async () => {
  // `src/proxy.ts` も確かめるが、ページは proxy に頼らずに確かめる（ADR-0036）
  if (!(await getCurrentAuthor())) forbidden();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">管理画面</h1>
      <nav aria-label="管理する項目" className="mt-8">
        <ul className="flex flex-col gap-2">
          {SECTIONS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
};

export default Page;
