import Link from 'next/link';

// `/dash/notes/{id}` と削除の確認の画面で、`id` の note が存在しないときの表示。
// JavaScript なしで送った保存・公開の後は、ページ全体を描画し直すため、別の画面で
// 削除された note ではフォームの結果の代わりにこれが出る
const NotFound = () => (
  <main>
    <h1>この note は存在しません</h1>
    <p>
      <Link href="/dash">note の一覧へ戻る</Link>
    </p>
  </main>
);

export default NotFound;
