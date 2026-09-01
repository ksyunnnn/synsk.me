import { chicLabel, isoDate, monthDay } from '../entryText';
import type { VariantProps } from './types';

/**
 * 案 Chic。アイコンを置かず、日付を左の固定列に取り、罫線でリズムを作る。
 * 動詞を使わない。ブランド色も使わない。
 *
 * ADR-0004 は Timeline でのプラットフォーム識別にアイコンを採っているため、
 * この案を採用する場合は ADR-0004 の supersede が要る。
 */
export const ChicTimeline = ({ groups }: VariantProps) => (
  <div className="mx-auto w-full max-w-[680px]">
    {groups.map((group) => (
      <section key={group.year} aria-labelledby={`chic-${group.year}`} className="mt-24 first:mt-0">
        <h2
          id={`chic-${group.year}`}
          className="text-2xl leading-[1.4] font-normal tracking-[-0.01em] text-foreground"
        >
          {group.year}
        </h2>

        <ol className="mt-6 border-t border-border">
          {group.entries.map((entry) => (
            <li key={entry.id} className="border-b border-border">
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="group grid grid-cols-[4.5rem_1fr] gap-x-6 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <time
                  dateTime={isoDate(entry.publishedAt)}
                  className="pt-[0.2em] text-xs leading-[1.5] tabular-nums text-muted-foreground"
                >
                  {monthDay(entry.publishedAt)}
                </time>

                <span className="min-w-0">
                  <h3 className="text-base leading-[1.6] font-normal text-foreground group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {entry.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-[1.5] font-normal tracking-[0.08em] text-muted-foreground uppercase">
                    {chicLabel(entry)}
                  </p>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    ))}
  </div>
);
