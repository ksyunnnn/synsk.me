// トップの下書き（src/app/top-draft/page.tsx）を写したもの。埋め込みと下のほうの節は入れない。
// timeline は entries.json（top-draft の並べ方で並べた、埋め込みを除く新しい 10 件）から読む
import { fontFamily, sourceSans } from '@/lib/fonts';

import entries from './entries.json';
import { SourceIcon } from './SourceIcon';

// articleHref を渡すと、リンクを持つ行（記事ページへの行）のリンク先をそれに替える
export const MockTop = ({ articleHref }: { articleHref?: string } = {}) => (
  <div
    className={`${sourceSans.className} bg-background text-foreground`}
    style={{
      fontFamily,
    }}
  >
    <div className="mx-auto grid max-w-[480px] gap-12 px-6 pt-4 pb-24 font-light">
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
          {entries.map((entry) => (
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
                <a
                  href={articleHref ?? entry.href}
                  className="font-normal underline underline-offset-4"
                >
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
                // ダミー画像は外部のサービスから直接読む
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
    </div>
  </div>
);
