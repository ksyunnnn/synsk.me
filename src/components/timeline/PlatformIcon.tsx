import { Planet } from '@phosphor-icons/react/ssr';
import { PLATFORM_META } from '@/lib/timeline/platforms';
import type { Platform } from '@/lib/timeline/types';

/**
 * ADR-0004 の 2 層構造に従う。Simple Icons に無い Platform
 * （connpass / CodePen）は Phosphor の Planet へ落とす。
 *
 * プラットフォーム名はどの案でもテキストで併記するため、
 * アイコンは装飾として aria-hidden にする。読み上げが二重になるのを避ける。
 */
export const PlatformIcon = ({
  platform,
  className,
  brandColor = false,
}: {
  platform: Platform;
  className?: string;
  /**
   * グリフにブランド色を当てる。案 Casual だけが使う。
   *
   * ブランド色は inline style で CSS 変数に入れ、色そのものはクラスで当てる。
   * inline style で色を直接指定すると `dark:` のクラス指定に勝ってしまい、
   * 暗い地で沈むプラットフォーム（GitHub の #181717 など）が読めなくなる。
   */
  brandColor?: boolean;
}) => {
  const meta = PLATFORM_META[platform];

  if (!meta.iconPath) {
    return <Planet aria-hidden="true" className={className} weight="regular" />;
  }

  const useBrand = brandColor && meta.brandHex !== null;

  return (
    <svg
      role="presentation"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={[useBrand ? 'text-(--brand-color) dark:text-foreground' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={useBrand ? ({ '--brand-color': meta.brandHex } as React.CSSProperties) : undefined}
    >
      <path d={meta.iconPath} />
    </svg>
  );
};
