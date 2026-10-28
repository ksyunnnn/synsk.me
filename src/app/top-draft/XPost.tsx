'use client';
// X の投稿の埋め込み。X の widgets.js が blockquote を投稿の見た目に置き換える。
// 高さは中身で決まり、widgets.js が合わせる
import { useEffect, useRef } from 'react';

type Twttr = { widgets?: { load: (el?: HTMLElement) => void } };

const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js';

export const XPost = ({ url }: { url: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const twttr = () => (window as unknown as { twttr?: Twttr }).twttr;
    // 読み込み済みなら自分の分だけ描く。読み込み中なら、読み終えたときに全部の投稿が描かれる
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      twttr()?.widgets?.load(ref.current ?? undefined);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => twttr()?.widgets?.load();
    document.body.appendChild(script);
  }, []);

  return (
    <div ref={ref}>
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
};
