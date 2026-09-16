# Software Design

> この文書は、コードの判断の軸（設計原則）と、形の定番（デザインパターン）を書く。なぜそう決めたかは書かない。

---

## Contents

- 設計原則
  1. 守る over 手軽さ
  2. 止まる over 危ない方へ進む
  3. 少なく正しく over 多く不確か
  4. 部分的に成り立つ over 全部か無か
  5. 誰でも使える作り over 見た目だけの再現
  6. 測って直す over 先回りで速くする
  7. 外の形は境目で止める over 内側まで通す
  8. 置き場を選ばない over 1つの環境に最適化
  9. 単純さ over 先回りの構造
- デザインパターン
  - Repository
  - DTO
  - 組み立て用の関数
  - Dependency Injection
  - 読む → 計算 → 書く
  - ユースケースを単位にする
  - Anti-Corruption Layer
  - 失敗の表し方
  - 見た目と操作を分ける

---

## 設計原則

上にある原則ほど優先する。原則どうしがぶつかったら、上にある方を取る。原則を破るときは理由を残す。日常的に破られる原則は、原則の方を直す。

原則は ISO/IEC 25010 の品質特性ごとに1つ置く。コードに当てはまらない特性には置かない。

### 1. 守る over 手軽さ

公開してはいけない値は外に出さず、作り手だけが変えられるデータは外から変えられない形を、手間が増えても選ぶ。

理由: 一度出た値や、書き換えられたデータは取り消せないため。

### 2. 止まる over 危ない方へ進む

公開・外への発信・費用のかかる処理は、判断に必要な値が欠けたら進めずに止める。量と回数には上限を設ける。

理由: 誤って発信した内容や、膨らんだ費用は取り消せないため。

### 3. 少なく正しく over 多く不確か

機能は、範囲を絞ってでも、満たすべきことを検査で確かめてから出す。

理由: 確かめていない機能は、壊れていても気づけないため。

### 4. 部分的に成り立つ over 全部か無か

一部の取得や処理が失敗しても、成り立つ部分は表示・処理する。

理由: 外部のサービスや一部のデータが欠けても、サイト全体が見られなくならないようにするため。

### 5. 誰でも使える作り over 見た目だけの再現

操作できる部品は、見た目だけでなく、キーボード・読み上げ・スマートフォンでも同じように使える作りにする。

理由: 見た目だけ合わせた部品は、使えない人がいることに気づかないまま残るため。

### 6. 測って直す over 先回りで速くする

速さと資源の使い方は、計測した値が閾値を割ったときに手を入れる。閾値の内側では、速さのために分かりやすさを削らない。

理由: 推測でした最適化は、効果が分からないまま、読みにくさだけを残すため。

### 7. 外の形は境目で止める over 内側まで通す

外部のサービスとやりとりするデータは、境目で synsk.me の形に詰め替え、外の形を内側に持ち込まない。

理由: 外部のサービスの仕様は、synsk.me の都合と関係なく変わるため。

### 8. 置き場を選ばない over 1つの環境に最適化

配信先やデータの置き場に固有の機能は、境目の内側だけで使う。

理由: 配信先やデータの置き場は替わるため。

### 9. 単純さ over 先回りの構造

包む・層・インタフェース・共通化は、差し替えや2つ目の使い道といった具体的な理由が出てから作る。

理由: 必要になる前に作った構造は、使われないまま、読むことと変えることの手間を増やすため。

---

## デザインパターン

コードの形の定番を置く。同じ形が2つ目の場所に出たら足す。もとにした原則を1つ以上指せるものだけを足す。静的解析で検査できる部分は、規約の設定が持つ。

1つのパターンには、名前（短い名詞句）・困ることと解き方・Bad と Good の短いコード・もとにした原則・手本のファイルを書く。手本のファイルは、その形を最初に書いたときに足す。名前は、広く通じる呼び名があればそれを使う。中身がずれるときは自分たちの名前を使い、どこがずれるかを書く。

### Repository

データベースを直接呼ぶと、データベースなしでは動かして確かめられない。見せてよいかの確認も呼ぶ側ごとに散らばり、確認を忘れた画面から値が漏れる。取り出し方と保存の仕方をインタフェースにして `domain/` に置き、実装を `server/` に置く。見せてよいかは、実装の中で、取り出すときに確かめる。

Bad: ユースケースがデータベースを直接呼び、画面で公開範囲を確かめる。

```ts
const { results } = await env.DB.prepare("SELECT * FROM projects").all();
const visible = results.filter((row) => row.visibility === "public");
```

Good: 取り出すときに確かめる実装を、インタフェース越しに使う。

```ts
const visible = await projects.listPublished();
```

一般名との違い: Repository（Fowler、Patterns of Enterprise Application Architecture）の定義は、ドメインとデータの取り出しの間に立つところまで。見せてよいかを確かめる役割は、synsk.me が足したもの。

もとにした原則: 1、8、9
手本のファイル: 未定（その形を最初に書いたときに足す）

### DTO

保存する形をそのまま画面へ渡すと、カラムが増えたときに、出すつもりのない値まで画面へ届く。画面に渡す形を別に作り、出してよい値だけを詰める。

Bad: 保存する形をそのまま渡す。非公開の `client` も一緒に渡る。

```tsx
const view = <ProjectCard project={row} />;
```

Good: 出してよい値だけを詰めた形に変えて渡す。

```tsx
const card: ProjectCardDto = { id: row.id, title: row.title, client: row.clientPublic };
const view = <ProjectCard project={card} />;
```

一般名との違い: Data Transfer Object（Fowler、同上）の目的は、呼び出しの回数を減らすこと。出してよい値の選別ではない。画面に渡す形という意味では Presentation Model が近い。

もとにした原則: 1
手本のファイル: 未定（その形を最初に書いたときに足す）

### 組み立て用の関数

画面ごとに部品を組み立てると、同じ組み立てが画面の数だけ散らばる。機能ごとに1か所で組み立て、画面はその関数を呼ぶだけにする。

Bad: 画面の中で組み立てる。

```ts
const projects = createProjectRepository(getDb());
const cards = await listProjectCardsUseCase(projects);
```

Good: 機能ごとに1か所で組み立て、画面はそれを呼ぶ。

```ts
// src/features/project/server/queries.ts
export async function listProjectCards() {
  return listProjectCardsUseCase(createProjectRepository(getDb()));
}
```

一般名との違い: Composition Root（Mark Seemann、2011-07-28）は、アプリケーション全体で1か所に置くもの。ここでは機能ごとに1か所に置くので、数が違う。

もとにした原則: 9
手本のファイル: 未定（その形を最初に書いたときに足す）

### Dependency Injection

使うものを関数の中で作ると、差し替えられない。データベースなしでは動かして確かめられなくなる。使うものは引数で受け取る。

Bad: 中で作る。

```ts
export async function publishNote(id: NoteId) {
  const notes = createNoteRepository(getDb());
}
```

Good: 外から受け取る。

```ts
export async function publishNote(notes: NoteRepository, id: NoteId) {}
```

一般名: Dependency Injection（Fowler、2004-01-23）。日本語は「依存性の注入」。引数で受け取る形は Constructor Injection にあたる。

もとにした原則: 9
手本のファイル: 未定（その形を最初に書いたときに足す）

### 読む → 計算 → 書く

計算の途中で読み書きすると、どこまで進んだかによって結果が変わり、確かめにくくなる。先にまとめて読み、計算だけの関数に渡し、最後に書く。

Bad: 計算の途中で読む。

```ts
for (const career of await careersRepo.list()) {
  const items = await projects.listByCareer(career.id);
  await resumes.save(buildResume([career], items));
}
```

Good: 先に読み、計算し、最後に書く。

```ts
const [careers, items] = await Promise.all([careersRepo.list(), projects.list()]);
const resume = buildResume(careers, items);
await resumes.save(resume);
```

一般名: Recawr Sandwich（Mark Seemann、2025-01-13）。読む・計算する・書くの順を指す。近い呼び名に Functional Core, Imperative Shell（Gary Bernhardt、2012）があり、こちらは順序までは定めない。

もとにした原則: 9
手本のファイル: 未定（その形を最初に書いたときに足す）

### ユースケースを単位にする

データの作成・更新・削除を並べると、「何をしたいのか」がコードから読めない。やりたいこと1つを関数の単位にし、その名前で呼ぶ。

Bad: データの更新として書く。

```ts
await notes.update(id, { status: "published", publishedAt: new Date() });
```

Good: やりたいことの名前で呼ぶ。

```ts
await publishNote(notes, id);
```

一般名との違い: Use Case（Robert C. Martin、2012-08-13）は層の名前で、その層がシステムのユースケースを持つ、と述べるところまで。関数1つを単位にするかどうかは定めていない。

もとにした原則: 9
手本のファイル: 未定（その形を最初に書いたときに足す）

### Anti-Corruption Layer

外部サービスが返す形のまま持ち回ると、相手の仕様が変わったときに、触る場所が全体に散らばる。取得したらすぐ、自分の形に変える。

Bad: 取得した形のまま画面まで運ぶ。

```tsx
const events = await fetchGitHubEvents();
const view = <Timeline events={events} />;
```

Good: 境目で自分の形に変える。

```tsx
const activities = (await fetchGitHubEvents()).map(toActivity);
const view = <Timeline activities={activities} />;
```

一般名: Anti-Corruption Layer（Eric Evans が Domain-Driven Design で示し、Microsoft Learn が同じ名で解説）。日本語は「腐敗防止層」。

もとにした原則: 7
手本のファイル: 未定（その形を最初に書いたときに足す）

### 失敗の表し方

取得元の1つが応答しないだけでページ全体が落ちると、表示できたはずの部分まで見られなくなる。失敗を投げずに、取れた分と欠けたことを返す。

Bad: 1つでも失敗すると、全体が落ちる。

```ts
const [github, rss] = await Promise.all([fetchGitHub(), fetchRss()]);
```

Good: 取れた分と、欠けた取得元を返す。

```ts
const settled = await Promise.allSettled([fetchGitHub(), fetchRss()]);
const result = {
  activities: settled.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
  failed: settled.filter((r) => r.status === "rejected").length,
};
```

一般名: 見つからない。Result 型は成功か失敗の二択で、一部だけ取れた状態を表さない。

もとにした原則: 4
手本のファイル: 未定（その形を最初に書いたときに足す）

### 見た目と操作を分ける

開閉・フォーカスの移動・キーボード操作を自前で書くと、見た目は同じでもキーボードや読み上げで使えない部品になる。操作は headless のライブラリに任せ、見た目をかぶせる。

Bad: 見た目の要素に、開閉だけを付ける。

```tsx
const view = <div onClick={() => setOpen(!open)}>設定</div>;
```

Good: 操作はライブラリが持ち、見た目だけを与える。

```tsx
const view = (
  <Dialog.Root>
    <Dialog.Trigger className="...">設定</Dialog.Trigger>
  </Dialog.Root>
);
```

一般名: headless UI。ライブラリの分類として通じる呼び名で、提唱者による定義はない。

もとにした原則: 5、9
手本のファイル: 未定（その形を最初に書いたときに足す）
