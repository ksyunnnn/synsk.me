import { PLATFORM_META } from '@/lib/timeline/platforms';
import { PlatformIcon } from '../PlatformIcon';
import { catnoseVerb, isoDate, longDate, shortDate } from '../entryText';
import type { VariantProps } from './types';

/**
 * 案 Catnose。catnose.me の実測値（2026-09-02 計測）を既存トークンへ載せ替える。
 * 点線レール、39px のアイコン輪、動詞文 + カードの 2 ブロック構成。
 *
 * 面は「帯 background / カード card」の 2 段にする。catnose.me は帯に薄い色を敷くが、
 * それを bg-muted で写すと muted-foreground が 4.35:1 となり
 * WCAG 2.2 SC 1.4.3 の AA を割るため、帯を background に置く。
 */
export const CatnoseTimeline = ({ groups }: VariantProps) => (
  <div className="mx-auto w-full max-w-[640px]">
    {groups.map((group) => (
      <section key={group.year} aria-labelledby={`catnose-${group.year}`} className="mb-16">
        <h2
          id={`catnose-${group.year}`}
          className="pt-3 text-xl leading-[1.4] font-medium text-foreground"
        >
          {group.year}
        </h2>

        <ol className="relative mt-6 ml-4 before:absolute before:top-[10px] before:bottom-0 before:left-[-2px] before:border-l-2 before:border-dotted before:border-border">
          {group.entries.map((entry) => {
            const isRelease =
              entry.kind === 'repository' || entry.kind === 'sandbox' || entry.kind === 'playlist';

            return (
              <li
                key={entry.id}
                className="relative pl-[29px] max-sm:pl-6 [&:not(:first-child)]:mt-11"
              >
                <span className="absolute -top-[9px] -left-5 flex size-[39px] items-center justify-center rounded-full border-[7px] border-background bg-background">
                  <PlatformIcon platform={entry.platform} className="size-[22px] text-foreground" />
                </span>

                <p className="text-sm leading-[1.4] font-medium text-muted-foreground">
                  {catnoseVerb(entry)}
                  <time
                    dateTime={isoDate(entry.publishedAt)}
                    className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs leading-[1.5]"
                  >
                    {shortDate(entry.publishedAt)}
                  </time>
                </p>

                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group mt-3 block rounded-2xl border-[1.5px] border-border bg-card px-5 py-5 transition-colors duration-150 hover:border-muted-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  <h3 className="text-[0.95rem] leading-[1.5] font-semibold text-card-foreground group-hover:underline group-hover:underline-offset-2">
                    {entry.title}
                  </h3>
                  <span className="mt-1.5 flex items-center gap-2 text-xs leading-[1.5] text-muted-foreground">
                    <PlatformIcon platform={entry.platform} className="size-4 shrink-0" />
                    {/* catnose.me はリリース系のメタを日付でなくドメインにしている。 */}
                    {isRelease
                      ? PLATFORM_META[entry.platform].label
                      : `${PLATFORM_META[entry.platform].label} · ${longDate(entry.publishedAt)}`}
                  </span>
                </a>

                {entry.summary ? (
                  <p className="mt-2.5 line-clamp-2 text-xs leading-[1.5] text-muted-foreground">
                    {entry.summary}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    ))}
  </div>
);
