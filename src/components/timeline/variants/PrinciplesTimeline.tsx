import { PLATFORM_META } from '@/lib/timeline/platforms';
import type { TimelineEntry } from '@/lib/timeline/types';
import { Thumbnail } from '../Thumbnail';
import { isoDate, shortDate } from '../entryText';
import type { VariantProps } from './types';

/**
 * 案 Principles。docs/PRINCIPLES.md と ADR-0005 から演繹した案。
 * 器を作らず、余白とサイズ差だけで構造を作る。
 *
 * OG 画像を出さない。Zenn / dev.to / GitHub の thumbnailUrl は自動生成の
 * OG 画像で、中身はタイトル文字である。隣に見出しがあるのに同じ文字を画像で
 * もう一度見せることは Anti-Principle「情報を詰め込まない」に当たる。
 * 画像を置くのは、画像そのものが作品である talk と playlist だけにする。
 * この判断で、サムネイルを持たない Qiita の欠損も起きなくなる。
 *
 * summary と metrics も出さない。summary は本文冒頭の機械的な切り出しで
 * 読み手に新しいことを言わず、metrics は数の誇示で「対話 over 展示」の
 * 展示側にある。残すのはタイトル・プラットフォーム・日付の 3 つ。
 *
 * ADR-0004 は Timeline でのプラットフォーム識別にアイコンを採っている。
 * この案はラベルをテキストで出すため、採用するには ADR-0004 の supersede が要る。
 */

/** ADR-0005 の caption（12px / 1.5）+ ラベルの letter-spacing 0.1em + uppercase。 */
const Meta = ({ entry }: { entry: TimelineEntry }) => (
  <span className="block text-xs leading-[1.5] tracking-[0.1em] text-muted-foreground uppercase">
    {PLATFORM_META[entry.platform].label}
    <span aria-hidden="true" className="mx-2">
      ·
    </span>
    <time dateTime={isoDate(entry.publishedAt)}>{shortDate(entry.publishedAt)}</time>
  </span>
);

/**
 * ADR-0005 の body（18px / 1.8）を見出しに当てる。タイトルは本文として読まれる。
 * 行数を切らない。切るのは密度側の判断であり、48px の間隔があれば詰まらない。
 */
const Title = ({ entry }: { entry: TimelineEntry }) => (
  <h3 className="mt-2 text-lg leading-[1.8] font-normal text-foreground">
    {entry.title}
    <span
      aria-hidden="true"
      className="ml-2 inline-block text-muted-foreground transition-transform duration-300 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
    >
      →
    </span>
  </h3>
);

const LINK =
  'group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const PrinciplesTimeline = ({ groups }: VariantProps) => (
  <div className="mx-auto w-full max-w-[720px]">
    {groups.map((group) => (
      <section
        key={group.year}
        aria-labelledby={`principles-${group.year}`}
        className="mt-24 first:mt-0"
      >
        <h2
          id={`principles-${group.year}`}
          className="text-[28px] leading-[1.4] font-normal tracking-[-0.01em] text-foreground"
        >
          {group.year}
        </h2>

        {/* 間隔は ADR-0005 の 8px スケールから外れない（8 / 16 / 24 / 48 / 96）。 */}
        <ol className="mt-12 space-y-12">
          {group.entries.map((entry) => (
            <li key={entry.id}>
              {entry.kind === 'playlist' ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${LINK} flex items-center gap-6`}
                >
                  <Thumbnail
                    entry={entry}
                    ratio="aspect-square"
                    className="size-40 shrink-0 rounded-md border border-border"
                  />
                  <span className="min-w-0">
                    <Meta entry={entry} />
                    <Title entry={entry} />
                  </span>
                </a>
              ) : (
                <a href={entry.url} target="_blank" rel="noreferrer" className={LINK}>
                  <Meta entry={entry} />
                  <Title entry={entry} />
                  {/* 画像はタイトルの後に置く。先に語りかけ、その根拠として見せる。 */}
                  {entry.kind === 'talk' ? (
                    <Thumbnail
                      entry={entry}
                      ratio="aspect-video"
                      className="mt-6 rounded-md border border-border"
                    />
                  ) : null}
                </a>
              )}
            </li>
          ))}
        </ol>
      </section>
    ))}
  </div>
);
