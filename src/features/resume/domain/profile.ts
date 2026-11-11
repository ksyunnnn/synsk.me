/**
 * 職務経歴書に載せるプロフィール（specs/002-resume/spec.md の FR-006・FR-034〜FR-036、
 * research.md の R10、plan.md の U6）。1 つだけで、職務経歴書に写さない。職務経歴書のページを
 * 作るたびにここから読むため、値を直すと作ったすべての職務経歴書に出る。
 *
 * 氏名・自己紹介・写真はこの定数に置く。生年月日は自己紹介の段落として、書いたままの形で置く。
 * メールアドレスはコードに書かず、環境変数 `RESUME_EMAIL`（src/shared/server/env.ts）から読む。
 */

export type Profile = {
  name: string;
  /** 段落は空行で区切る */
  introduction: string;
  /** `public/` の下の画像の経路。丸く切り抜いて出す */
  photoSrc: string;
  /** 欠ければ職務経歴書に出さない（constitution IV） */
  email: string | null;
};

/** オーナーが値を入れる */
export const PROFILE_CONTENT: Omit<Profile, 'email'> = {
  name: '小橋俊介',
  introduction: 'プロダクト実装のファシリテーター\n\n生年月日: 1992/2/23',
  photoSrc: '/profile-photo.jpg',
};

/** 定数と環境変数の値からプロフィールを作る。空のメールアドレスは欠けたものとする */
export const toProfile = (email: string | undefined): Profile => ({
  ...PROFILE_CONTENT,
  email: email?.trim() || null,
});
