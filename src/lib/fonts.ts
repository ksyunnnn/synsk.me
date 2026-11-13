// トップの下書き・lab・訪問者に見せる職務経歴書で使う書体（英語 Source Sans 3、日本語 Noto Sans JP）。読み込みはこのファイルだけで行う。
// 同じ組み合わせを複数のファイルで読み込むと、ビルドの前もって作る段階で書体のファイルが見つからずに失敗した（2026-11-04）
import { Noto_Sans_JP, Noto_Serif_JP, Source_Sans_3, Tinos } from 'next/font/google';

export const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['300', '400', '600'] });
const notoSansJp = Noto_Sans_JP({ weight: ['300', '400', '600'], preload: false });

export const fontFamily = `${sourceSans.style.fontFamily}, ${notoSansJp.style.fontFamily}, sans-serif`;

// トップ（`/`）で使う書体。Figma の「小橋俊介 study」の指定（英語 Tinos、日本語 Noto Serif JP）
export const tinos = Tinos({ subsets: ['latin'], weight: ['400'] });
export const notoSerifJp = Noto_Serif_JP({ weight: ['400'], preload: false });
