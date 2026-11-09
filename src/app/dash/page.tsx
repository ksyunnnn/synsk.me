import type { Metadata } from 'next';
import { requireAuthor } from '@/shared/server/author';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '管理画面 | synsk.me' };

/** 各一覧への入口。経路は specs/001-career-and-project/contracts/dash.md・specs/002-resume/contracts/dash.md・specs/003-note/contracts/dash.md */
const SECTIONS = [
  { href: '/dash/careers', label: '職歴' },
  { href: '/dash/projects', label: '実績' },
  { href: '/dash/educations', label: '学歴' },
  { href: '/dash/skills', label: 'スキル' },
  { href: '/dash/organizations', label: '組織' },
  { href: '/dash/resumes', label: '職務経歴書' },
  { href: '/dash/notes', label: 'note' },
] as const;

const Page = async () => {
  // `src/proxy.ts` も確かめるが、ページは proxy に頼らずに確かめる（ADR-0036）
  await requireAuthor();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">管理画面</h1>
      <nav aria-label="管理する項目" className="mt-8">
        <ul className="flex flex-col gap-2">
          {SECTIONS.map(({ href, label }) => (
            <li key={href}>
              <TextLink href={href}>{label}</TextLink>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
};

export default Page;
