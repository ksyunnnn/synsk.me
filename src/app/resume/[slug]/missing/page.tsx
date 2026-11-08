import { notFound } from 'next/navigation';

// 中身を返さない限定公開用の要求（下書き・期限切れ・識別子が無い）を、`src/proxy.ts` が
// ここへ rewrite する。何も読まずに `notFound()` を呼ぶため、ストリーミングの前に 404 が決まる。
// 画面に何を示すかは specs/002-resume/plan.md の U10 で決まっておらず、既定の 404 の画面を出す
const Page = () => {
  notFound();
};

export default Page;
