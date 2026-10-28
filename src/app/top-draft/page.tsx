// 新しいトップの下書き。#148 のローデザイン（配置と呼び名だけ）をそのまま書いたもの。
// timeline は mock-data.json（値はすべて作り物）から読み、列の値をそのまま出す。完成したら中身を `/` に移し、このフォルダを消す。
import type { Metadata } from 'next';
import { Noto_Sans_JP, Source_Sans_3 } from 'next/font/google';
import Link from 'next/link';

import { getTimeline } from './mockTimeline';
import { SourceIcon } from './SourceIcon';

const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['300', '400', '600'] });
const notoSansJp = Noto_Sans_JP({ weight: ['300', '400', '600'], preload: false });

export const metadata: Metadata = {
  title: 'トップの下書き | synsk.me',
  robots: { index: false, follow: false },
};

const TextLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="w-fit font-normal underline underline-offset-4">
    {children}
  </Link>
);

const Page = async () => {
  'use cache';
  return (
    <div
      className={`${sourceSans.className} min-h-screen bg-background text-foreground`}
      style={{
        fontFamily: `${sourceSans.style.fontFamily}, ${notoSansJp.style.fontFamily}, sans-serif`,
      }}
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
          <ul className="grid gap-4">
            {getTimeline().map((entry) => (
              <li
                key={entry.key}
                className="grid gap-1.5 border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{entry.sortAt}</span>
                  <SourceIcon source={entry.label} className="size-3.5" />
                  <span>{entry.label}</span>
                  {entry.kind && <span>{entry.kind}</span>}
                </div>
                {entry.href ? (
                  <a href={entry.href} className="font-normal underline underline-offset-4">
                    {entry.title}
                  </a>
                ) : (
                  <span className="font-normal">{entry.title}</span>
                )}
                {entry.organization && <span className="text-sm">{entry.organization}</span>}
                {entry.description && (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {entry.description}
                  </p>
                )}
                {entry.imageUrl && (
                  // ダミー画像は外部のサービスから直接読む。最適化はデザインが決まってから考える
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.imageUrl}
                    alt=""
                    width={1200}
                    height={630}
                    loading="lazy"
                    className="aspect-[1200/630] w-full rounded-md object-cover"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4">
          <div className="grid min-h-[120px] place-items-center rounded-xl border-[1.5px] border-dashed border-muted-foreground p-6 text-center text-sm text-muted-foreground">
            つながりの可視化
            <br />
            （手段は未定）
          </div>
        </section>

        <section className="grid gap-4">
          <TextLink href="/resume">職務経歴書を見る →</TextLink>
          <TextLink href="/about">自己紹介へ →</TextLink>
        </section>

        <section id="contact" className="grid gap-4">
          <Link
            href="/contact"
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
