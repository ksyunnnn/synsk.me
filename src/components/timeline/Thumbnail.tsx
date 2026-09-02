'use client';

import { useState } from 'react';
import type { TimelineEntry } from '@/lib/timeline/types';
import { PlatformIcon } from './PlatformIcon';

/**
 * サムネイルを固定比の井戸に敷く。
 *
 * 井戸の比を固定するのは、画像の到着でレイアウトを動かさないため
 * （ADR-0017 の CLS 目標値 0）。読み込みに失敗したら PlatformIcon へ落とし、
 * 壊れた画像アイコンを出さない。画像を持たないエントリも同じ状態になるので、
 * 欠損は特別扱いではなく井戸の既定状態として扱える。
 *
 * 画像は装飾。`alt=""` にし、情報は隣の見出しとメタ行が持つ。
 */
export const Thumbnail = ({
  entry,
  ratio,
  className = '',
}: {
  entry: TimelineEntry;
  /** `aspect-[2/1]` や `aspect-video` など。呼び出し側が決める。 */
  ratio: string;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(entry.thumbnailUrl) && !failed;

  return (
    <span className={`relative block overflow-hidden bg-muted ${ratio} ${className}`}>
      {showImage ? (
        // next/image を使わない。対象は 8 つの外部ホストにまたがり、
        // next.config.js の images.remotePatterns に 1 つも登録が無い。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <PlatformIcon platform={entry.platform} className="size-8 text-muted-foreground" />
        </span>
      )}
    </span>
  );
};
