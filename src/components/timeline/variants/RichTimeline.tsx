import { Play } from '@phosphor-icons/react/ssr';
import { PLATFORM_META } from '@/lib/timeline/platforms';
import type { TimelineEntry } from '@/lib/timeline/types';
import { PlatformIcon } from '../PlatformIcon';
import { Thumbnail } from '../Thumbnail';
import { isoDate, shortDate } from '../entryText';
import type { VariantProps } from './types';

/**
 * 案 Rich。kind ごとに器を変え、Speaker Deck と Spotify には
 * 媒体そのものの形（16:9 / 1:1）を与える。
 *
 * hover で面を塗らない。ライトの accent は muted と同値の #f5f5f5 で、
 * カード内の muted-foreground が 4.35:1 に落ちるため。浮きと枠の濃さで代える。
 */

const CARD =
  'group block rounded-lg border border-border bg-card transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-muted-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0';

const MetaLine = ({ entry }: { entry: TimelineEntry }) => (
  <span className="flex items-center gap-2 text-xs leading-[1.5] text-muted-foreground">
    <PlatformIcon platform={entry.platform} className="size-4 shrink-0" brandColor />
    {PLATFORM_META[entry.platform].label}
    <span aria-hidden="true">·</span>
    <time dateTime={isoDate(entry.publishedAt)}>{shortDate(entry.publishedAt)}</time>
  </span>
);

const Body = ({ entry, showMetrics }: { entry: TimelineEntry; showMetrics: boolean }) => (
  <>
    <MetaLine entry={entry} />
    <h3 className="mt-2 line-clamp-2 text-lg leading-[1.6] font-normal text-foreground group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
      {entry.title}
    </h3>
    {entry.summary ? (
      <p className="mt-2 line-clamp-2 text-sm leading-[1.6] text-muted-foreground">
        {entry.summary}
      </p>
    ) : null}
    {showMetrics && entry.metrics && entry.metrics.length > 0 ? (
      <p className="mt-4 text-xs leading-[1.5] tabular-nums text-muted-foreground">
        {entry.metrics.map((metric) => `${metric.label} ${metric.value}`).join(' · ')}
      </p>
    ) : null}
  </>
);

/**
 * 画像を持たず metrics を持つエントリの右列。
 *
 * 地を background にする。muted にするとラベルの muted-foreground が
 * 4.35:1 になり WCAG 2.2 SC 1.4.3 の AA を割る。
 */
const MetricsTile = ({ metrics }: { metrics: NonNullable<TimelineEntry['metrics']> }) => (
  <span
    className={`grid aspect-[2/1] items-center divide-x divide-border rounded-lg border border-border bg-background ${
      metrics.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
    }`}
  >
    {metrics.map((metric) => (
      <span key={metric.label} className="flex flex-col items-center gap-1">
        <span className="text-2xl leading-none tabular-nums text-foreground">{metric.value}</span>
        <span className="text-xs leading-[1.5] tracking-[0.1em] text-muted-foreground uppercase">
          {metric.label}
        </span>
      </span>
    ))}
  </span>
);

/**
 * 記事系。右列は画像の場所として固定しない。
 *
 * 比を 2:1 にしたのは、実データの OG 画像（Zenn 1200x630 / dev.to 1000x500 /
 * GitHub 1200x600）がいずれもタイトル文字を焼き込んでいるため。1:1 に切ると
 * 文字が読めない断片になる。
 */
const LinkCard = ({ entry }: { entry: TimelineEntry }) => {
  const hasThumbnail = Boolean(entry.thumbnailUrl);
  const metrics = entry.metrics && entry.metrics.length > 0 ? entry.metrics : undefined;
  // 画像も metrics も無いエントリは右列を作らない。埋まらない枠を空けたままにしない。
  const showAside = hasThumbnail || metrics !== undefined;

  return (
    <li className="col-span-full">
      <a
        href={entry.url}
        target="_blank"
        rel="noreferrer"
        className={`${CARD} flex flex-col gap-6 p-6 md:flex-row md:items-start`}
      >
        {showAside ? (
          <span className="w-full shrink-0 md:order-last md:w-[200px]">
            {hasThumbnail ? (
              <Thumbnail
                entry={entry}
                ratio="aspect-[2/1]"
                className="rounded-lg border border-border"
              />
            ) : metrics ? (
              <MetricsTile metrics={metrics} />
            ) : null}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          {/* 右列が metrics タイルのときは、テキスト列に同じ数を重ねて出さない。 */}
          <Body entry={entry} showMetrics={hasThumbnail} />
        </span>
      </a>
    </li>
  );
};

/** 発表。1 枚目のスライドを 16:9 のまま出す。切らない。 */
const TalkCard = ({ entry }: { entry: TimelineEntry }) => (
  <li className="col-span-full">
    <a href={entry.url} target="_blank" rel="noreferrer" className={`${CARD} overflow-hidden`}>
      <Thumbnail entry={entry} ratio="aspect-video" className="border-b border-border" />
      <span className="block p-6">
        <Body entry={entry} showMetrics />
      </span>
    </a>
  </li>
);

/**
 * プレイリスト。アートワークが器になるので枠を持たない。
 *
 * embedUrl は使わない。playlist 1 件につきサードパーティの iframe が 1 つ増え、
 * ADR-0017 の LCP と INP の値を、playlist が並ぶ年で割ることになるため。
 */
const PlaylistCard = ({ entry }: { entry: TimelineEntry }) => (
  <li className="col-span-1">
    <a
      href={entry.url}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-lg transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className="relative block">
        <Thumbnail
          entry={entry}
          ratio="aspect-square"
          className="rounded-lg border border-border"
        />
        <span
          aria-hidden="true"
          className="absolute right-3 bottom-3 flex size-10 scale-90 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          <Play weight="fill" className="size-4 translate-x-px" />
        </span>
      </span>
      <h3 className="mt-4 line-clamp-2 text-sm leading-[1.6] font-normal text-foreground">
        {entry.title}
      </h3>
      <span className="mt-1 block">
        <MetaLine entry={entry} />
      </span>
    </a>
  </li>
);

export const RichTimeline = ({ groups }: VariantProps) => (
  <div className="mx-auto w-full max-w-[880px]">
    {groups.map((group) => (
      <section key={group.year} aria-labelledby={`rich-${group.year}`} className="mt-24 first:mt-0">
        <h2
          id={`rich-${group.year}`}
          className="text-[28px] leading-[1.4] font-normal tracking-[-0.01em] text-foreground"
        >
          {group.year}
        </h2>

        {/* grid-auto-flow は既定の row にする。dense にすると publishedAt 降順が崩れる。 */}
        <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3">
          {group.entries.map((entry) => {
            if (entry.kind === 'playlist') return <PlaylistCard key={entry.id} entry={entry} />;
            if (entry.kind === 'talk') return <TalkCard key={entry.id} entry={entry} />;
            return <LinkCard key={entry.id} entry={entry} />;
          })}
        </ol>
      </section>
    ))}
  </div>
);
