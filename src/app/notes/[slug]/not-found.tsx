// 下書きの note・削除した note・存在しない slug に、同じ表示を返す。区別できる違いを
// 訪問者に見せない（specs/005-note-write-and-read/spec.md の FR-011）
const NotFound = () => (
  <main>
    <h1>note が見つかりません</h1>
  </main>
);

export default NotFound;
