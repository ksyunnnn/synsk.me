// delay-visuals の画面の外側（iPhone の Safari のステータスバーとツールバーの後ろ、引っぱったときに見える部分）も、
// 画面と同じ灰色のざらつきにする。サイトの body は bg-background（白）なので、このアプリの間だけ html に地を敷き、body を透かす。
// ルート要素の背景はキャンバス全体に広がる（CSS Backgrounds and Borders Module Level 3 の 2.11.1）
import type { Viewport } from 'next';

// 細かいざらつき。濃さ 0.15 で multiply して重ねる。256px の模様を敷き詰め、画面の高さによらず粒の大きさを同じにする
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")";

const CANVAS = `
html {
  min-height: 100%;
  background-color: hsl(var(--border));
  background-image: ${NOISE}, linear-gradient(165deg, hsl(var(--muted)), hsl(var(--border)));
  background-size: 256px 256px, 100% 100%;
  background-repeat: repeat, no-repeat;
  background-blend-mode: multiply, normal;
}
body {
  background: transparent;
}
`;

// theme-color はトークンの値を直に書く。meta の値は CSS の変数を読めない。border（hsl(0 0% 89.8%)）と同じ色。
// iOS 15〜18 の Safari はこの色をステータスバーと引っぱったときの部分に使う。Safari 26 からはホーム画面に追加したときだけ使う
// （MDN の browser-compat-data の Safari の注記）。Safari 26 の帯の色は html と body の背景から決まる
// viewport-fit=cover で、画面いっぱい（ステータスバーとツールバーの後ろまで）に描く。中身は env(safe-area-inset-*) で
// 内側に収める（WebKit「Designing Websites for iPhone X」）
export const viewport: Viewport = {
  themeColor: '#e5e5e5',
  viewportFit: 'cover',
};

const Layout = ({ children }: { children: React.ReactNode }) => (
  <>
    <style>{CANVAS}</style>
    {children}
  </>
);

export default Layout;
