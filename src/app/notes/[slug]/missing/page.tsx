import { notFound } from 'next/navigation';

// 無い識別子・下書き・削除した note の要求を、`src/proxy.ts` がここへ rewrite する。何も読まずに
// `notFound()` を呼ぶため、ストリーミングの前に 404 が決まる
const Page = () => {
  notFound();
};

export default Page;
