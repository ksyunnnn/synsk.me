'use client';

import { useEffect, useRef, useState } from 'react';
import { PLATFORM_META } from '@/lib/timeline/platforms';
import type { TimelineEntry } from '@/lib/timeline/types';
import { PlatformIcon } from '../PlatformIcon';
import { Thumbnail } from '../Thumbnail';
import { isoDate, shortDate } from '../entryText';
import type { VariantProps } from './types';

/**
 * 案 Embed。埋め込みを持つプラットフォームは、実物をその場で動かす。
 *
 * サーバ側からの取得が Cloudflare の bot challenge で塞がれている
 * CodeSandbox と CodePen も、埋め込みは閲覧者のブラウザが直接読むため描画される。
 * 「取得できない」と「埋め込めない」は別の問題である。
 *
 * 埋め込みは押されたときに初めて読み込む。iframe を最初から並べると、
 * サードパーティのフレームがエントリの数だけ増え、ADR-0017 の LCP と INP の
 * 値を割る。静止画と題を先に出し、操作で実物へ替える。
 */

/** iframe の高さ。媒体ごとに素の比率が違う。 */
const EMBED_HEIGHT: Partial<Record<TimelineEntry['platform'], string>> = {
  spotify: 'h-[352px]',
  speakerdeck: 'aspect-video',
  codesandbox: 'h-[500px]',
  codepen: 'h-[400px]',
  // X は投稿ごとに高さが違う。埋め込みが送ってくる値で上書きする。
  x: 'h-[560px]',
};

/**
 * X の埋め込みは、描き終えた高さを親へ postMessage で知らせる。
 * 受け取って iframe の高さに反映し、投稿ごとの余白を消す。
 */
function useEmbedHeight(enabled: boolean) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    if (!enabled) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://platform.twitter.com') return;
      if (event.source !== frame.current?.contentWindow) return;

      const payload = typeof event.data === 'string' ? safeParse(event.data) : event.data;
      const params = payload?.['twttr.embed']?.params;
      const next = Array.isArray(params) ? params[0]?.height : undefined;
      if (typeof next === 'number' && next > 0) setHeight(next);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [enabled]);

  return { frame, height };
}

function safeParse(value: string): Record<string, { params?: unknown[] }> | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

const MetaLine = ({ entry }: { entry: TimelineEntry }) => (
  <span className="flex items-center gap-2 text-xs leading-[1.5] text-muted-foreground">
    <PlatformIcon platform={entry.platform} className="size-4 shrink-0" brandColor />
    {PLATFORM_META[entry.platform].label}
    <span aria-hidden="true">·</span>
    <time dateTime={isoDate(entry.publishedAt)}>{shortDate(entry.publishedAt)}</time>
  </span>
);

/**
 * 押されるまで iframe を作らない。
 *
 * 押す前の見せ方は、静止画を持つかどうかで変える。持つものは実寸の井戸に
 * 静止画を敷き、押すとその場が実物へ替わる。持たないものに同じ高さの井戸を
 * 置くと、空の面が画面を占めるだけになるため、1 行のボタンに畳む。
 *
 * 押した後の高さは押す前と変わるが、これは操作に対する応答であり、
 * 読んでいる最中に起きるレイアウトの移動ではない。
 */
const Embed = ({
  entry,
  live,
  onOpen,
}: {
  entry: TimelineEntry;
  live: boolean;
  onOpen: () => void;
}) => {
  const height = EMBED_HEIGHT[entry.platform] ?? 'aspect-video';
  const label = PLATFORM_META[entry.platform].label;
  const { frame, height: measured } = useEmbedHeight(live && entry.platform === 'x');

  // X の埋め込みは幅 550px で描かれる。広い器に左寄せで置くと余白が偏る。
  const wrapper = entry.platform === 'x' ? 'mx-auto w-full max-w-[550px]' : 'w-full';

  if (live) {
    return (
      <div className={wrapper}>
        <iframe
          ref={frame}
          src={entry.embedUrl}
          title={`${label}: ${entry.title}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          className={`w-full rounded-lg border border-border bg-muted ${measured ? '' : height}`}
          style={measured ? { height: measured } : undefined}
        />
      </div>
    );
  }

  const openLabel = `${label} をここで開く`;

  // 静止画を持たないものは、空の面を置かず 1 行に畳む。
  if (!entry.thumbnailUrl) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group/embed flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-xs text-muted-foreground transition-colors duration-200 hover:border-muted-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <PlatformIcon platform={entry.platform} className="size-4 shrink-0" />
        {openLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/embed relative block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Thumbnail
        entry={entry}
        ratio={height}
        className="rounded-lg border border-border transition-colors duration-200 group-hover/embed:border-muted-foreground/40 motion-reduce:transition-none"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-foreground px-4 py-2 text-xs text-background opacity-90 transition-opacity duration-200 group-hover/embed:opacity-100 motion-reduce:transition-none">
          {openLabel}
        </span>
      </span>
    </button>
  );
};

/**
 * 1 エントリ。
 *
 * X の埋め込みは本文をそのまま描くため、開いた後は上の見出しと重なる。
 * 見出しは読み上げと構造のために残し、視覚的にだけ畳む。
 */
const EmbedEntry = ({ entry, autoOpen }: { entry: TimelineEntry; autoOpen: boolean }) => {
  const [opened, setOpened] = useState(false);
  // autoOpen は後から切り替わる。useState の初期値では追随しないため合成する。
  const live = opened || autoOpen;
  const titleIsDuplicated = live && entry.platform === 'x';

  return (
    <li>
      <MetaLine entry={entry} />
      <h3
        className={
          titleIsDuplicated ? 'sr-only' : 'mt-2 text-lg leading-[1.6] font-normal text-foreground'
        }
      >
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="hover:underline hover:decoration-1 hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {entry.title}
        </a>
      </h3>

      {entry.summary && !titleIsDuplicated ? (
        <p className="mt-2 line-clamp-2 text-sm leading-[1.6] text-muted-foreground">
          {entry.summary}
        </p>
      ) : null}

      {/* 埋め込みを持つものだけ実物を出す。持たないものは題と要約で終える。 */}
      {entry.embedUrl ? (
        <div className="mt-6">
          <Embed entry={entry} live={live} onOpen={() => setOpened(true)} />
        </div>
      ) : null}
    </li>
  );
};

export const EmbedTimeline = ({
  groups,
  autoOpen = false,
}: VariantProps & { autoOpen?: boolean }) => (
  <div className="mx-auto w-full max-w-[720px]">
    {groups.map((group) => (
      <section
        key={group.year}
        aria-labelledby={`embed-${group.year}`}
        className="mt-24 first:mt-0"
      >
        <h2
          id={`embed-${group.year}`}
          className="text-[28px] leading-[1.4] font-normal tracking-[-0.01em] text-foreground"
        >
          {group.year}
        </h2>

        <ol className="mt-6 space-y-12">
          {group.entries.map((entry) => (
            <EmbedEntry key={entry.id} entry={entry} autoOpen={autoOpen} />
          ))}
        </ol>
      </section>
    ))}
  </div>
);
