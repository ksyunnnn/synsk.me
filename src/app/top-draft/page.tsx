// 新しいトップの下書き。#148 のローデザイン（配置と呼び名だけ）をそのまま書いたもの。
// timeline は D1 の一覧（specs/005-feed）を出す（#166）。完成したら中身を `/` に移し、このフォルダを消す。
import type { Metadata } from 'next';
import Link from 'next/link';

import { Feed } from '@/features/activity/components/feed';
import { readFeedPage } from '@/features/activity/domain/feed';
import { listFeedItems } from '@/features/activity/server/feed-queries';
import { fontFamily, sourceSans } from '@/lib/fonts';
import { routes } from '@/shared/routes';

// 要求時のデータ（D1）を `<Suspense>` の外で読み、描画を終えてから応答を返す。D1 から読めない
// ときに 500 を返すため、`loading.tsx` を置かない。キャッシュしない（specs/005-feed/research.md の R9）
export const instant = false;

const PATH = routes.top;

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export const metadata: Metadata = {
  title: 'トップの下書き | synsk.me',
  robots: { index: false, follow: false },
};

const TextLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="w-fit font-normal underline underline-offset-4">
    {children}
  </Link>
);

const Page = async ({ searchParams }: Props) => {
  const page = readFeedPage((await searchParams).page);
  const { items, hasNextPage } = await listFeedItems(page);
  return (
    <div
      className={`${sourceSans.className} min-h-screen bg-background text-foreground`}
      style={{ fontFamily }}
    >
      <main className="mx-auto grid max-w-[480px] gap-12 px-6 pt-4 pb-24 font-light">
        <div className="flex items-center justify-end gap-2">
          <a href="#contact" className="font-normal underline underline-offset-4">
            連絡
          </a>
        </div>

        <section className="grid gap-4">
          <p className="text-lg font-semibold">Firstname Lastname</p>
        </section>

        <section className="grid gap-4">
          <Feed items={items} page={page} hasNextPage={hasNextPage} basePath={PATH} />
        </section>

        <section className="grid gap-4">
          <div className="grid min-h-[120px] place-items-center rounded-xl border-[1.5px] border-dashed border-muted-foreground p-6 text-center text-sm text-muted-foreground">
            つながりの可視化
            <br />
            （手段は未定）
          </div>
        </section>

        <section className="grid gap-4">
          <TextLink href={routes.resumes}>職務経歴書を見る →</TextLink>
          <TextLink href={routes.about}>自己紹介へ →</TextLink>
        </section>

        <section id="contact" className="grid gap-4">
          <Link
            href={routes.contact}
            className="inline-flex h-11 w-fit items-center rounded-full border border-foreground px-6 font-normal"
          >
            連絡する
          </Link>
          <ul className="flex gap-3">
            {[1, 2, 3, 4].map((key) => (
              <li key={key} className="h-6 w-6 rounded-full border border-border bg-muted" />
            ))}
          </ul>
        </section>

        <section className="grid gap-4">
          <div className="grid min-h-20 place-items-center rounded-md border border-border bg-muted text-sm text-muted-foreground">
            名刺デザインの項目
          </div>
        </section>
      </main>
    </div>
  );
};

export default Page;
