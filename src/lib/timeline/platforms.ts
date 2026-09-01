import {
  siCodesandbox,
  siDevdotto,
  siGithub,
  siMedium,
  siQiita,
  siSpeakerdeck,
  siSpotify,
  siX,
  siZenn,
} from 'simple-icons';
import type { Platform } from './types';

export interface PlatformMeta {
  label: string;
  /**
   * Simple Icons の 24x24 path。
   * ADR-0004 に従い、Simple Icons に存在しない Platform は null とし、
   * 呼び出し側で Phosphor Icons の Planet にフォールバックする。
   */
  iconPath: string | null;
  /** Simple Icons のブランド色。iconPath が null の Platform は持たない。 */
  brandHex: string | null;
  profileUrl: string;
}

/**
 * connpass / TECHPLAY / CodePen は simple-icons 16.29.0 に存在しない。
 * 実測: https://cdn.jsdelivr.net/npm/simple-icons@16.29.0/icons/codepen.svg → 404
 */
export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  zenn: {
    label: 'Zenn',
    iconPath: siZenn.path,
    brandHex: `#${siZenn.hex}`,
    profileUrl: 'https://zenn.dev/ksyunnnn',
  },
  qiita: {
    label: 'Qiita',
    iconPath: siQiita.path,
    brandHex: `#${siQiita.hex}`,
    profileUrl: 'https://qiita.com/ksyunnnn',
  },
  devto: {
    label: 'dev.to',
    iconPath: siDevdotto.path,
    brandHex: `#${siDevdotto.hex}`,
    profileUrl: 'https://dev.to/ksyunnnn',
  },
  medium: {
    label: 'Medium',
    iconPath: siMedium.path,
    brandHex: `#${siMedium.hex}`,
    profileUrl: 'https://medium.com/@ksyunnnn',
  },
  github: {
    label: 'GitHub',
    iconPath: siGithub.path,
    brandHex: `#${siGithub.hex}`,
    profileUrl: 'https://github.com/ksyunnnn',
  },
  speakerdeck: {
    label: 'Speaker Deck',
    iconPath: siSpeakerdeck.path,
    brandHex: `#${siSpeakerdeck.hex}`,
    profileUrl: 'https://speakerdeck.com/ksyunnnn',
  },
  codesandbox: {
    label: 'CodeSandbox',
    iconPath: siCodesandbox.path,
    brandHex: `#${siCodesandbox.hex}`,
    profileUrl: 'https://codesandbox.io/u/ksyunnnn',
  },
  codepen: {
    label: 'CodePen',
    iconPath: null,
    brandHex: null,
    profileUrl: 'https://codepen.io/ksyunnnn',
  },
  connpass: {
    label: 'connpass',
    iconPath: null,
    brandHex: null,
    profileUrl: 'https://connpass.com/user/ksyunnnn/',
  },
  spotify: {
    label: 'Spotify',
    iconPath: siSpotify.path,
    brandHex: `#${siSpotify.hex}`,
    profileUrl: 'https://open.spotify.com/user/21xqcp2fwj4histejz5mtqlsi',
  },
  x: {
    label: 'X',
    iconPath: siX.path,
    brandHex: `#${siX.hex}`,
    profileUrl: 'https://x.com/ksyunnnn',
  },
};
