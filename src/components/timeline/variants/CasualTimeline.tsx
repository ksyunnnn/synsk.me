import { PlatformIcon } from '../PlatformIcon';
import { casualVerb, isoDate, relativeDate } from '../entryText';
import type { VariantProps } from './types';

/**
 * 案 Casual。48px のアイコンチップ、広い余白、ブランド色をグリフ 1 点に使う。
 *
 * 日付ピルの地に bg-muted を使わない。ライトの muted-foreground(#737373) は
 * muted(#f5f5f5) 上で 4.35:1 と WCAG 2.2 SC 1.4.3 の AA を割るため、
 * 地を background に置き枠線で囲む（4.74:1）。
 */
export const CasualTimeline = ({ groups, now }: VariantProps) => (
  <div className="mx-auto w-full max-w-[720px]">
    {groups.map((group) => (
      <section key={group.year} aria-labelledby={`casual-${group.year}`} className="mt-24 first:mt-0">
        <h2
          id={`casual-${group.year}`}
          className="text-2xl leading-[1.4] font-normal tracking-[-0.01em] text-foreground"
        >
          {group.year}
        </h2>

        <ol className="mt-6 space-y-2">
          {group.entries.map((entry) => (
            <li key={entry.id} className="group relative">
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="-mx-4 flex gap-4 rounded-xl px-4 py-4 transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <PlatformIcon platform={entry.platform} className="size-6 dark:text-foreground" brandColor />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm leading-[1.6] font-normal text-muted-foreground">
                    {casualVerb(entry)}
                    <time
                      dateTime={isoDate(entry.publishedAt)}
                      className="rounded-full border border-border bg-background px-2 py-0.5 text-xs leading-[1.5]"
                    >
                      {relativeDate(entry.publishedAt, now)}
                    </time>
                  </span>

                  <h3 className="mt-1 line-clamp-2 text-lg leading-[1.6] font-normal text-foreground">
                    {entry.title}
                  </h3>

                  {entry.metrics && entry.metrics.length > 0 ? (
                    <p className="mt-2 text-xs leading-[1.5] text-muted-foreground">
                      {entry.metrics.map((metric) => `${metric.label} ${metric.value}`).join(' · ')}
                    </p>
                  ) : null}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>
    ))}
  </div>
);
