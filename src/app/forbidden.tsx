import Link from 'next/link';
import { routes } from '@/shared/routes';

// `forbidden()` が呼ばれたときの表示。オーナーでない要求を `src/proxy.ts` が
// `/dash/forbidden` へ rewrite し、そこで呼ぶ。
// このファイルがないと、vinext 1.2.1 ではリンクで移動したときの 403 を受け止める画面がなく、
// 画面全体が消える。ページを直接開いたときは、ストリーミングの前に 403 が決まる
const Forbidden = () => (
  <main>
    <h1>このページを開く権限がありません</h1>
    <p>
      <Link href={routes.home}>トップページへ戻る</Link>
    </p>
  </main>
);

export default Forbidden;
