'use client';

import { useState } from 'react';
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
};

const MetaLine = ({ entry }: { entry: TimelineEntry }) => (
  <span className="flex items-center gap-2 text-xs leading-[1.5] text-muted-foreground">
    <PlatformIcon platform={entry.platform} className="size-4 shrink-0" brandColor />
    {PLATFORM_META[entry.platform].label}
    <span aria-hidden="true">·</span>
    <time dateTime={isoDate(entry.publishedAt)}>{shortDate(entry.publishedAt)}</time>
  </span>
);

/**
 * 押されるまで iframe を作らない枠。
 *
 * 押す前は静止画（無ければプラットフォームのグリフ）を出す。押した後は
 * 実物が入る。title を持たせ、フレームの中身が何かを支援技術へ伝える。
 */
const Embed = ({ entry }: { entry: TimelineEntry }) => {
  const [live, setLive] = useState(false);
  const height = EMBED_HEIGHT[entry.platform] ?? 'aspect-video';

  if (live) {
    return (
      <iframe
        src={entry.embedUrl}
        title={`${PLATFORM_META[entry.platform].label}: ${entry.title}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        className={`w-full rounded-lg border border-border bg-muted ${height}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLive(true)}
      className="group/embed relative block w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Thumbnail
        entry={entry}
        ratio={height}
        className="rounded-lg border border-border transition-colors duration-200 group-hover/embed:border-muted-foreground/40 motion-reduce:transition-none"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-foreground px-4 py-2 text-xs text-background opacity-90 transition-opacity duration-200 group-hover/embed:opacity-100 motion-reduce:transition-none">
          {PLATFORM_META[entry.platform].label} をここで開く
        </span>
      </span>
    </button>
  );
};

export const EmbedTimeline = ({ groups }: VariantProps) => (
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
            <li key={entry.id}>
              <MetaLine entry={entry} />
              <h3 className="mt-2 text-lg leading-[1.6] font-normal text-foreground">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline hover:decoration-1 hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {entry.title}
                </a>
              </h3>

              {entry.summary ? (
                <p className="mt-2 line-clamp-2 text-sm leading-[1.6] text-muted-foreground">
                  {entry.summary}
                </p>
              ) : null}

              {/* 埋め込みを持つものだけ実物を出す。持たないものは題と要約で終える。 */}
              {entry.embedUrl ? (
                <div className="mt-6">
                  <Embed entry={entry} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    ))}
  </div>
);
