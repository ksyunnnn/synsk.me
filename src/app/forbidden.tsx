import { BackToTopLink } from '@/shared/components/back-to-top-link';

// `forbidden()` が呼ばれたときの表示。オーナーでない要求を `src/proxy.ts` が
// `/dash/forbidden` へ rewrite し、そこで呼ぶ。
// このファイルがないと、vinext 1.2.1 ではリンクで移動したときの 403 を受け止める画面がなく、
// 画面全体が消える。ページを直接開いたときは、ストリーミングの前に 403 が決まる
const Forbidden = () => (
  <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
    <h1 className="text-2xl font-bold">このページを開く権限がありません</h1>
    <BackToTopLink />
  </main>
);

export default Forbidden;
