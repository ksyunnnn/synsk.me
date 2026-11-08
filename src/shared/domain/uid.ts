/**
 * 管理画面の URL とフォームで行を指す識別子。DB が行を作るときに入れ、書き換えない
 * （migrations/0011_add_uid_for_dash_url.sql）。主キーは URL に出さない（ADR-0048、
 * specs/001-career-and-project/research.md の R17）
 */
export type Uid = string;

/** 32 文字の 16 進（英小文字）だけを通す。形の違う値は、D1 を読まずに無い行として扱う */
export const parseUid = (value: string): Uid | null =>
  /^[0-9a-f]{32}$/.test(value) ? value : null;
