import { notFound } from 'next/navigation';

// 訪問者に見せる note が無い識別子の要求を、`src/proxy.ts` がここへ rewrite する。下書き・
// 下書きに戻した・削除した note も含む（specs/003-note/contracts/visitor-note.md）。何も読まずに
// `notFound()` を呼ぶため、ストリーミングの前に 404 が決まり、中身を応答に含めない
const Page = () => {
  notFound();
};

export default Page;
