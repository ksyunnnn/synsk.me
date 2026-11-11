// lab はデザインの実験の置き場。lab の外のコードから lab のファイルを import しない
// lab の下のページは、すべて検索エンジンに載せない
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const Layout = ({ children }: { children: React.ReactNode }) => children;

export default Layout;
