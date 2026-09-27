// 下書きの note と存在しない slug に、同じ表示を返す。両者を区別できる違いを
// 訪問者に見せない（specs/005-note-write-and-read/spec.md の FR-011）
const NotFound = () => (
  <main>
    <h1>note が見つかりません</h1>
  </main>
);

export default NotFound;
