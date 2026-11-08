/**
 * オーナー。src/shared/server/author.ts が Access の JWT を検証して作る（ADR-0036）。
 * ユースケースがオーナーかを受け取るため、型を domain に置く
 */
export type Author = { email: string };
