import Link from 'next/link';

// `/dash/notes/{id}` と、削除・戻す確認の画面で、`id` の note が存在しないときの表示。
// 削除した note の編集と削除の確認の画面、削除していない note の戻す確認の画面でも出る。
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
