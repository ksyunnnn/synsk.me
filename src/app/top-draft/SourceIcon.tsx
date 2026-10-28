// activity.source のアイコン。ADR-0004 の 2 層構造と PR #47 の PlatformIcon に従う。
// Simple Icons に無いもの（connpass・CodePen・登録していないサイト）は Phosphor の Planet に落とす
import { Planet } from '@phosphor-icons/react/ssr';
import {
  type SimpleIcon,
  siCodesandbox,
  siDevdotto,
  siGithub,
  siMedium,
  siQiita,
  siSpeakerdeck,
  siSpotify,
  siX,
  siYoutube,
  siZenn,
} from 'simple-icons';

const ICONS: Record<string, SimpleIcon | null> = {
  zenn_article: siZenn,
  qiita_article: siQiita,
  devto_article: siDevdotto,
  medium_article: siMedium,
  speakerdeck_talk: siSpeakerdeck,
  github_repository: siGithub,
  connpass_event: null,
  spotify_playlist: siSpotify,
  x_post: siX,
  codepen_sandbox: null,
  codesandbox_sandbox: siCodesandbox,
  youtube_video: siYoutube,
  unlisted: null,
};

// source の名前を文字で並べて出すため、アイコンは装飾として読み上げない
export const SourceIcon = ({ source, className }: { source: string; className?: string }) => {
  if (!(source in ICONS)) return null;
  const icon = ICONS[source];
  if (!icon) return <Planet aria-hidden="true" className={className} weight="regular" />;
  return (
    <svg
      role="presentation"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d={icon.path} />
    </svg>
  );
};
