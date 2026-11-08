/**
 * 管理画面の Server Action が返す結果（specs/001-career-and-project/contracts/dash.md の共通）。
 * 使い手は project・career・education・skill・organization の Server Action。
 *
 * 成功したときは Server Action が別の画面へ移すため、結果を画面に返すのは失敗のときと、
 * 移さずに同じ画面で知らせるときだけになる。失敗の結果は、送られた値を持ち、画面は
 * 入力を消さずに理由を示す。
 *
 * `Field` は入力の項目の名前。`Reason` は項目ごとの誤りの理由。
 */
export type ActionResult<Field extends string, Reason extends string = string> =
  /** 保存した。同じ画面で知らせるときに使う */
  | { status: 'saved' }
  /** オーナーでない。何も書かない（FR-040） */
  | { status: 'forbidden' }
  /** 項目の不備。項目ごとの理由と、送られた値を返す */
  | {
      status: 'invalid';
      errors: Partial<Record<Field, Reason>>;
      values: Partial<Record<Field, string>>;
    }
  /** 開いた後に、別の画面で先に書き換えられていた。何も書かない（FR-042） */
  | { status: 'conflict'; values: Partial<Record<Field, string>> };
