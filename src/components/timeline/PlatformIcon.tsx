import { Planet } from '@phosphor-icons/react/ssr';
import { PLATFORM_META } from '@/lib/timeline/platforms';
import type { Platform } from '@/lib/timeline/types';

/**
 * ADR-0004 の 2 層構造に従う。Simple Icons に無い Platform
 * （connpass / TECHPLAY / CodePen）は Phosphor の Planet へ落とす。
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
  /** グリフにブランド色を当てる。案 Casual だけが使う。 */
  brandColor?: boolean;
}) => {
  const meta = PLATFORM_META[platform];

  if (!meta.iconPath) {
    return <Planet aria-hidden="true" className={className} weight="regular" />;
  }

  return (
    <svg
      role="presentation"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      // 暗い地でブランド色が沈むため、ダークでは currentColor に戻す。
      style={brandColor && meta.brandHex ? { color: meta.brandHex } : undefined}
    >
      <path d={meta.iconPath} />
    </svg>
  );
};
