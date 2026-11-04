// トップの下書きと lab で使う書体（英語 Source Sans 3、日本語 Noto Sans JP）。読み込みはこのファイルだけで行う。
// 同じ組み合わせを複数のファイルで読み込むと、ビルドの前もって作る段階で書体のファイルが見つからずに失敗した（2026-11-04）
import { Noto_Sans_JP, Source_Sans_3 } from 'next/font/google';

export const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['300', '400', '600'] });
export const notoSansJp = Noto_Sans_JP({ weight: ['300', '400', '600'], preload: false });

export const fontFamily = `${sourceSans.style.fontFamily}, ${notoSansJp.style.fontFamily}, sans-serif`;
