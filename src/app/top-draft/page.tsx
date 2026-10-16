// 新しいトップの下書き。#148 のローデザイン（配置と呼び名だけ）をそのまま書いたもの。
// データとはつながず、値はすべてダミー。完成したら中身を `/` に移し、このフォルダを消す。
import type { Metadata } from 'next';
import { Noto_Sans_JP, Source_Sans_3 } from 'next/font/google';

const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['300', '400', '600'] });
const notoSansJp = Noto_Sans_JP({ weight: ['300', '400', '600'], preload: false });

export const metadata: Metadata = {
  title: 'トップの下書き | synsk.me',
  robots: { index: false, follow: false },
};

const ENTRIES = [
  { date: '2026-10-12', width: 'w-4/5', project: 'project ラベル' },
  { date: '2026-10-05', width: 'w-3/5', project: null },
  { date: '2026-09-28', width: 'w-4/5', project: null },
];

const PROJECTS = ['project A', 'project B', 'project C'];

const Label = ({ children, dummy = false }: { children: React.ReactNode; dummy?: boolean }) => (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    {children}
    {dummy && <span className="rounded-sm border border-muted-foreground px-1 text-[10px] leading-4">ダミー</span>}
  </div>
);

// 行き先が決まるまでは、リンクの見た目だけを持たせる
const TextLink = ({ children }: { children: React.ReactNode }) => (
  <span className="w-fit font-normal underline underline-offset-4">{children}</span>
);

const Page = () => {
  return (
    <div
      className={`${sourceSans.className} min-h-screen bg-background text-foreground`}
      style={{ fontFamily: `${sourceSans.style.fontFamily}, ${notoSansJp.style.fontFamily}, sans-serif` }}
    >
      <main className="mx-auto grid max-w-[480px] gap-12 px-6 pt-4 pb-24 font-light">
        <div className="flex items-center justify-end gap-2">
          <Label>連絡の入口へのリンク（右上）</Label>
          <a href="#contact" className="font-normal underline underline-offset-4">
            連絡
          </a>
        </div>

        <section className="grid gap-4">
          <Label dummy>名前</Label>
          <p className="text-lg font-semibold">Firstname Lastname</p>
        </section>

        <section className="grid gap-4">
          <Label dummy>timeline の新着</Label>
          <ul className="grid gap-4">
            {ENTRIES.map((entry) => (
              <li key={entry.date} className="grid gap-1.5 border-b border-border pb-4 last:border-b-0 last:pb-0">
                <span className="text-xs text-muted-foreground tabular-nums">{entry.date}</span>
                <div className={`h-2.5 rounded-full bg-muted ${entry.width}`} />
                {entry.project ? (
                  <span className="w-fit rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {entry.project}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">ラベルなし</span>
                )}
              </li>
            ))}
          </ul>
          <Label>timeline 全体へのリンク</Label>
          <TextLink>すべて見る →</TextLink>
        </section>

        <section className="grid gap-4">
          <Label>つながりの可視化</Label>
          <div className="grid min-h-[120px] place-items-center rounded-xl border-[1.5px] border-dashed border-muted-foreground p-6 text-center text-sm text-muted-foreground">
            つながりの可視化
            <br />
            （手段は未定）
          </div>
        </section>

        <section className="grid gap-4">
          <Label>職務経歴書へのリンク</Label>
          <TextLink>職務経歴書を見る →</TextLink>
          <Label dummy>project ラベルの一覧</Label>
          <ul className="flex flex-wrap gap-2">
            {PROJECTS.map((project) => (
              <li key={project} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {project}
              </li>
            ))}
          </ul>
          <Label>自己紹介へのリンク</Label>
          <TextLink>自己紹介へ →</TextLink>
        </section>

        <section id="contact" className="grid gap-4">
          <Label>連絡の入口</Label>
          <span className="inline-flex h-11 w-fit items-center rounded-full border border-foreground px-6 font-normal">
            連絡する
          </span>
          <Label>SNS へのリンク</Label>
          <ul className="flex gap-3">
            {[1, 2, 3, 4].map((key) => (
              <li key={key} className="h-6 w-6 rounded-full border border-border bg-muted" />
            ))}
          </ul>
        </section>

        <section className="grid gap-4">
          <Label>名刺デザインの項目</Label>
          <div className="min-h-20 rounded-md border border-border bg-muted" />
        </section>
      </main>
    </div>
  );
};

export default Page;
