import type { ReactNode } from 'react';

/**
 * CSS の url() に載せられる形か検査する。
 *
 * URL は外部 API が返す値なので、そのまま style へ入れない。
 * encodeURI は使えない。Zenn の OG 画像 URL のように符号化済みの値を
 * 二重符号化してしまうため。http(s) に限り、CSS 上で意味を持つ文字を弾く。
 */
function cssUrl(url: string): string | undefined {
  if (!/^https?:\/\//.test(url)) return undefined;
  if (/["'()\\\s]/.test(url)) return undefined;
  return url;
}

/**
 * サムネイルを敷く。
 *
 * `<img>` ではなく背景画像で敷くのは、読み込みに失敗したときに
 * 壊れた画像アイコンを出さないため。失敗すると地の色だけが残る。
 *
 * 画像に alt を持たせられないため装飾として扱う。タイトルは必ず
 * テキストで隣に置き、画像だけが情報を運ぶ形にしない。
 */
export const Thumbnail = ({
  url,
  className,
  fallback,
}: {
  url: string | undefined;
  /** 寸法と角丸は呼び出し側が決める。 */
  className: string;
  /** 画像を持たないエントリに置くもの。 */
  fallback?: ReactNode;
}) => {
  const safeUrl = url ? cssUrl(url) : undefined;

  if (!safeUrl) {
    return (
      <div aria-hidden="true" className={`flex items-center justify-center bg-muted ${className}`}>
        {fallback}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`bg-muted bg-cover bg-center ${className}`}
      style={{ backgroundImage: `url("${safeUrl}")` }}
    />
  );
};
