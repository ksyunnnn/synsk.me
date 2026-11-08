import 'server-only';

/**
 * Server Action が受け取った `FormData` から値を読む。文字列でない値（ファイル）と、送られて
 * いない項目は空の文字列として扱う
 */

/** 項目の値。無ければ空の文字列 */
export const readString = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

/** 同じ名前で送られた値のすべて。チェックボックスの並びなどに使う */
export const readStrings = (formData: FormData, name: string) =>
  formData.getAll(name).filter((value): value is string => typeof value === 'string');

/** 並べた項目の値を、項目の名前をキーにして読む */
export const readValues = <F extends string>(formData: FormData, fields: readonly F[]) =>
  Object.fromEntries(fields.map((field) => [field, readString(formData, field)])) as Record<
    F,
    string
  >;
