import { BackToTopLink } from '@/shared/components/back-to-top-link';

// `notFound()` が呼ばれたときの表示。無い識別子の要求は、`src/proxy.ts` が `/{種類}/{slug}/missing`
// へ rewrite し、そこで呼ぶ。何も読まない。どの値も出さないので、訪問者と管理画面で同じ画面を使う
const NotFound = () => (
  <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
    <h1 className="text-2xl font-bold">ページが見つかりません</h1>
    <p>URL が違うか、ページが無くなったか、公開をやめたページです。</p>
    <BackToTopLink />
  </main>
);

export default NotFound;
